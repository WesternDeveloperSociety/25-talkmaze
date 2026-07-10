import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/services/supabase/types/database";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezonePlugin from "dayjs/plugin/timezone";
import type {
  PendingBookingPreviewPayload,
  PreviewCalendarEvent,
} from "@/src/lib/scheduling/types";

dayjs.extend(utc);
dayjs.extend(timezonePlugin);

// === Types === //

export type PreviewPendingBookingInput = {
  bookingId: string;
  coachId: string;
  weekday: number;
  startTime: string; // HH:mm[:ss]
  endTime: string; // HH:mm[:ss]
  timezone: string;
  numSessions: number;
  startDate?: string; // YYYY-MM-DD, optional
};

export type PreviewPendingBookingResult =
  | ({ ok: true } & PendingBookingPreviewPayload)
  | { ok: false; status: number; error: string };

type Conflict = PendingBookingPreviewPayload["conflicts"][number];

type AvailabilityInterval = {
  weekday: number;
  start: number;
  end: number;
};

// === Helpers === //

function normalizeTime(value: string) {
  return /^\d{2}:\d{2}$/.test(value) ? `${value}:00` : value;
}

function normalizeAvailabilityTime(value: string | null) {
  if (!value) return null;
  if (/^\d{2}:\d{2}$/.test(value)) return `${value}:00`;
  if (/^\d{2}:\d{2}:\d{2}$/.test(value)) return value;
  if (value.length > 10) return `${value.slice(11, 16)}:00`;
  return null;
}

function timeStringToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTimeString(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function toAvailabilityIntervals(
  rows:
    | {
        weekday: number | null;
        start_time: string | null;
        end_time: string | null;
        start_time_new: string | null;
        end_time_new: string | null;
      }[]
    | null,
) {
  return (rows ?? [])
    .map((slot) => {
      const start = normalizeAvailabilityTime(
        slot.start_time_new ?? slot.start_time,
      );
      const end = normalizeAvailabilityTime(slot.end_time_new ?? slot.end_time);
      if (slot.weekday == null || !start || !end) return null;
      return {
        weekday: slot.weekday,
        start: timeStringToMinutes(start),
        end: timeStringToMinutes(end),
      };
    })
    .filter(
      (slot): slot is AvailabilityInterval => !!slot && slot.start < slot.end,
    );
}

function intervalContains(
  intervals: AvailabilityInterval[],
  weekday: number,
  start: number,
  end: number,
) {
  return intervals.some(
    (interval) =>
      interval.weekday === weekday &&
      interval.start <= start &&
      interval.end >= end,
  );
}

function buildAvailabilityEvents(
  coachAvailability: AvailabilityInterval[],
  studentAvailability: AvailabilityInterval[],
): PreviewCalendarEvent[] {
  const events: PreviewCalendarEvent[] = [];

  for (let weekday = 0; weekday <= 6; weekday++) {
    const dayCoach = coachAvailability.filter(
      (slot) => slot.weekday === weekday,
    );
    const dayStudent = studentAvailability.filter(
      (slot) => slot.weekday === weekday,
    );
    const boundaries = Array.from(
      new Set(
        [...dayCoach, ...dayStudent].flatMap((slot) => [slot.start, slot.end]),
      ),
    ).sort((a, b) => a - b);

    for (let i = 0; i < boundaries.length - 1; i++) {
      const start = boundaries[i];
      const end = boundaries[i + 1];
      if (start === end) continue;

      const coachCan = intervalContains(dayCoach, weekday, start, end);
      const studentCan = intervalContains(dayStudent, weekday, start, end);
      if (!coachCan && !studentCan) continue;

      const variant =
        coachCan && studentCan
          ? { kind: "availability-both" as const, title: "Both available" }
          : studentCan
            ? {
                kind: "availability-student" as const,
                title: "Student available",
              }
            : { kind: "availability-coach" as const, title: "Coach available" };

      events.push({
        daysOfWeek: [weekday],
        startTime: minutesToTimeString(start),
        endTime: minutesToTimeString(end),
        ...variant,
      });
    }
  }

  return events;
}

function nextMatchingDateForWeekday(weekday: number) {
  let testDate = dayjs.utc().add(1, "day");
  while (testDate.day() !== weekday) {
    testDate = testDate.add(1, "day");
  }
  return testDate.format("YYYY-MM-DD");
}

function startDateForPreview(startDate: string | undefined, weekday: number) {
  return startDate && /^\d{4}-\d{2}-\d{2}$/.test(startDate)
    ? startDate
    : nextMatchingDateForWeekday(weekday);
}

function recurringSlotRangeForOccurrence(
  slot: {
    weekday: number;
    start_time: string;
    end_time: string;
    timezone: string;
  },
  occurrenceStartUTC: dayjs.Dayjs,
) {
  const slotDateLocal = occurrenceStartUTC.tz(slot.timezone).day(slot.weekday);
  const slotStartLocal = dayjs.tz(
    `${slotDateLocal.format("YYYY-MM-DD")}T${slot.start_time}`,
    slot.timezone,
  );
  const slotEndLocal = dayjs.tz(
    `${slotDateLocal.format("YYYY-MM-DD")}T${slot.end_time}`,
    slot.timezone,
  );
  return { startUTC: slotStartLocal.utc(), endUTC: slotEndLocal.utc() };
}

// === Main === //

/**
 * Compute a "what-if" preview for approving a pending booked slot:
 *   - The coach's + student's availability shaded by overlap.
 *   - The coach's existing sessions on the calendar.
 *   - The coach's existing recurring booked slots.
 *   - The proposed session occurrences (up to numSessions × 3 weeks of search).
 *   - Any conflicts detected.
 */
export async function previewPendingBooking(
  supabase: SupabaseClient<Database>,
  input: PreviewPendingBookingInput,
): Promise<PreviewPendingBookingResult> {
  const startTime = normalizeTime(input.startTime);
  const endTime = normalizeTime(input.endTime);

  if (startTime >= endTime) {
    return {
      ok: false,
      status: 400,
      error: "Start time must be before end time",
    };
  }
  if (
    input.startDate &&
    new Date(`${input.startDate}T12:00:00Z`).getUTCDay() !== input.weekday
  ) {
    return {
      ok: false,
      status: 400,
      error: "Start date must match the selected weekday",
    };
  }

  const { data: pendingSlot, error: pendingSlotError } = await supabase
    .from("booked_slots")
    .select("id, student_id")
    .eq("id", input.bookingId)
    .eq("status", "pending")
    .single();

  if (pendingSlotError || !pendingSlot) {
    return { ok: false, status: 404, error: "Pending booked slot not found" };
  }

  const [
    { data: availability },
    { data: studentAvailability },
    { data: sessions },
    { data: activeSlots },
    { data: student },
  ] = await Promise.all([
    supabase
      .from("coach_availabilities")
      .select("weekday, start_time, end_time, start_time_new, end_time_new")
      .eq("coach_id", input.coachId),
    supabase
      .from("student_availabilities")
      .select("weekday, start_time, end_time, start_time_new, end_time_new")
      .eq("student_id", pendingSlot.student_id),
    supabase
      .from("sessions")
      .select(
        "id, start_time, end_time, student_id, students(first_name, last_name)",
      )
      .eq("coach_id", input.coachId),
    supabase
      .from("booked_slots")
      .select("*, students(first_name, last_name)")
      .eq("status", "active")
      .or(
        `coach_id.eq.${input.coachId},student_id.eq.${pendingSlot.student_id}`,
      ),
    supabase
      .from("students")
      .select("first_name, last_name")
      .eq("id", pendingSlot.student_id)
      .maybeSingle(),
  ]);

  const availabilityEvents = buildAvailabilityEvents(
    toAvailabilityIntervals(availability ?? null),
    toAvailabilityIntervals(studentAvailability ?? null),
  );

  const existingSessionEvents: PreviewCalendarEvent[] = (sessions ?? [])
    .filter(
      (session: { start_time: string | null }) => session.start_time != null,
    )
    .map(
      (session: {
        id: number | string;
        start_time: string | null;
        end_time: string | null;
        students:
          | { first_name: string | null; last_name: string | null }
          | { first_name: string | null; last_name: string | null }[]
          | null;
      }) => {
        const sessionStudent = Array.isArray(session.students)
          ? session.students[0]
          : session.students;
        const studentName = sessionStudent
          ? `${sessionStudent.first_name ?? ""} ${sessionStudent.last_name ?? ""}`.trim() ||
            "Booked"
          : "Booked";
        return {
          id: `existing-${session.id}`,
          kind: "session" as const,
          title: studentName,
          start: session.start_time!,
          end: session.end_time ?? undefined,
        };
      },
    );

  const activeBookedEvents: PreviewCalendarEvent[] = (activeSlots ?? [])
    .filter((slot) => slot.coach_id === input.coachId)
    .map((slot) => {
      const slotStudent = Array.isArray(slot.students)
        ? slot.students[0]
        : slot.students;
      const studentLabel = slotStudent
        ? `${slotStudent.first_name ?? ""} ${slotStudent.last_name ?? ""}`.trim() ||
          "Recurring booked"
        : "Recurring booked";
      return {
        id: `active-${slot.id}`,
        kind: "recurring-block" as const,
        title: studentLabel,
        daysOfWeek: [slot.weekday],
        startTime: slot.start_time.slice(0, 5),
        endTime: slot.end_time.slice(0, 5),
      };
    });

  const studentName = student
    ? `${student.first_name ?? ""} ${student.last_name ?? ""}`.trim() ||
      "Proposed"
    : "Proposed";
  const durationMinutes = Math.max(
    1,
    timeStringToMinutes(endTime) - timeStringToMinutes(startTime),
  );
  const anchorDate = startDateForPreview(input.startDate, input.weekday);
  const anchorStart = dayjs.tz(`${anchorDate}T${startTime}`, input.timezone);

  const proposedEvents: PreviewCalendarEvent[] = [];
  const conflictEvents: PreviewCalendarEvent[] = [];
  const conflicts: Conflict[] = [];
  let successfullyGenerated = 0;
  let weekOffset = 0;
  const maxWeeks = input.numSessions * 3;

  while (successfullyGenerated < input.numSessions && weekOffset <= maxWeeks) {
    const targetDate = anchorStart.add(weekOffset, "week").format("YYYY-MM-DD");
    const occurrenceStart = dayjs.tz(
      `${targetDate}T${startTime}`,
      input.timezone,
    );
    const occurrenceEnd = occurrenceStart.add(durationMinutes, "minute");
    const occurrenceStartUTC = occurrenceStart.utc();
    const occurrenceEndUTC = occurrenceEnd.utc();

    const hasSessionConflict = (sessions ?? []).some((session) => {
      if (!session.start_time || !session.end_time) return false;
      return (
        occurrenceStartUTC.isBefore(dayjs.utc(session.end_time)) &&
        occurrenceEndUTC.isAfter(dayjs.utc(session.start_time))
      );
    });

    const hasRecurringConflict = (activeSlots ?? []).some((slot) => {
      if (!slot.timezone || !slot.start_time || !slot.end_time) return false;
      const range = recurringSlotRangeForOccurrence(slot, occurrenceStartUTC);
      return (
        occurrenceStartUTC.isBefore(range.endUTC) &&
        occurrenceEndUTC.isAfter(range.startUTC)
      );
    });

    if (hasSessionConflict || hasRecurringConflict) {
      const reason = hasSessionConflict
        ? "Overlaps an existing session"
        : "Overlaps an active recurring booking";
      conflictEvents.push({
        id: `conflict-${weekOffset}`,
        kind: "conflict",
        title: reason,
        start: occurrenceStartUTC.toISOString(),
        end: occurrenceEndUTC.toISOString(),
      });
      conflicts.push({
        start: occurrenceStartUTC.toISOString(),
        end: occurrenceEndUTC.toISOString(),
        reason,
      });
    } else {
      proposedEvents.push({
        id: `proposed-${weekOffset}`,
        kind: "proposed",
        title: `Proposed: ${studentName}`,
        start: occurrenceStartUTC.toISOString(),
        end: occurrenceEndUTC.toISOString(),
      });
      successfullyGenerated++;
    }

    weekOffset++;
  }

  return {
    ok: true,
    events: [
      ...availabilityEvents,
      ...activeBookedEvents,
      ...existingSessionEvents,
      ...proposedEvents,
      ...conflictEvents,
    ],
    conflicts,
    canApprove: proposedEvents.length === input.numSessions,
    generatedCount: proposedEvents.length,
    requestedCount: input.numSessions,
  };
}
