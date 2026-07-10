import type { TablesInsert } from "@/src/services/supabase/types/database";

export type CoachingSession = {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  description?: string;
  student_id?: string;
  studentName: string;
  coachName?: string;
  status?: string;
};

export type SchedulingResult = {
  success: boolean;
  status: number;
  message?: string;
  error?: string;
};

export type BookedSlotForApproval = {
  id: string;
  coach_id: string;
  student_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  timezone: string;
  status: string;
  num_sessions: number | null;
  start_date: string | null;
};

export type PendingBooking = {
  id: string;
  coach_id: string;
  student_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  timezone: string;
  status: string;
  num_sessions: number | null;
  start_date: string | null;
  created_at: string;
  coaches?: { first_name: string | null; last_name: string | null } | null;
  students?: {
    first_name: string | null;
    last_name: string | null;
    account_id: string | null;
  } | null;
};

export type PendingBookingForm = {
  coach_id: string;
  weekday: number;
  start_date: string;
  start_time: string;
  end_time: string;
  timezone: string;
  num_sessions: number;
};

export type GeneratedSession = TablesInsert<"sessions">;

/**
 * Semantic calendar-event categories. Presentation (colors) is mapped
 * client-side in src/components/common/calendar/eventKinds.ts +
 * src/styles/calendar/event-kinds.css
 */
export type CalendarEventKind =
  | "session" // booked session (mint)
  | "session-pending-reschedule" // session with a pending reschedule request (gold)
  | "availability-coach"
  | "availability-student"
  | "availability-both"
  | "recurring-block" // active recurring booked_slot (background shading)
  | "proposed" // what-if occurrence from the pending-booking preview (gold)
  | "conflict"; // occurrence that collides with existing bookings (red)

/** Semantic calendar event - no presentation. Dated or weekly-recurring. */
export type PreviewCalendarEvent = {
  id?: string;
  kind: CalendarEventKind;
  title: string;
} & (
  | { start: string; end?: string } // dated occurrence (UTC ISO)
  | { daysOfWeek: number[]; startTime: string; endTime: string } // weekly recurrence (HH:mm)
);

/** Response body of POST /api/admin/pending-bookings/[id]/preview. */
export type PendingBookingPreviewPayload = {
  events: PreviewCalendarEvent[];
  conflicts: { start: string; end: string; reason: string }[];
  canApprove: boolean;
  generatedCount: number;
  requestedCount: number;
};

/**
 * Day-of-week names in the order shown to users (Monday-first).
 *
 * Note: this differs from the DB's numeric `weekday` column, which follows the
 * JS convention (Sunday = 0 … Saturday = 6). Conversions live with the callers.
 */
export const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export type Weekday = (typeof WEEKDAYS)[number];
