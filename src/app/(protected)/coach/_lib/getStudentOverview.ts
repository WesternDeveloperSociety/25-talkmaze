import "server-only";

import { createClient } from "@/src/services/supabase/server";
import type { Database } from "@/src/services/supabase/types/database";
import { computeAttendanceStreak } from "@/src/utils/attendanceStreak";

type Lesson = Database["public"]["Tables"]["lessons"]["Row"];

export interface StudentOverviewActiveCourse {
  id: string;
  title: string;
  description: string | null;
  badgeUrl: string | null;
  completedLessons: number;
  totalLessons: number;
  currentLessonTitle: string | null;
  /** 1-based position of the lesson the student is working on. */
  currentLessonNumber: number;
}

export interface StudentOverviewUpcomingSession {
  id: number;
  start_time: string;
  end_time: string | null;
  reschedule_status: string | null;
}

export interface StudentOverview {
  bio: string | null;
  parentName: string | null;
  sessionsRemaining: number | null;
  sessionsTotal: number | null;
  streak: number;
  preferredTime: string | null;
  activeCourse: StudentOverviewActiveCourse | null;
  upcomingSessions: StudentOverviewUpcomingSession[];
}

const WEEKDAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "16:00:00" -> "4:00 PM" (wall-clock, timezone-independent). */
function formatWallClock(time: string | null): string | null {
  if (!time) return null;
  const [hStr, mStr] = time.split(":");
  const h = Number(hStr);
  if (Number.isNaN(h)) return null;
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${mStr ?? "00"} ${period}`;
}

/** Orders a course's lessons by its head -> next linked list, created_at fallback. */
function orderLessons(
  lessons: Lesson[],
  headLessonId: string | null,
): Lesson[] {
  const byId = new Map(lessons.map((l) => [l.id, l]));
  const ordered: Lesson[] = [];
  const seen = new Set<string>();

  let current = headLessonId ? byId.get(headLessonId) : undefined;
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    ordered.push(current);
    current = current.next_lesson ? byId.get(current.next_lesson) : undefined;
  }

  // Append any lessons not reachable through the linked list (broken chain),
  // in created_at order, so totals stay accurate.
  const leftovers = lessons
    .filter((l) => !seen.has(l.id))
    .sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
  return [...ordered, ...leftovers];
}

/**
 * Assembles everything the coach Overview tab needs for one student. Ownership
 * is enforced by the caller (the student layout only renders for assigned
 * students), so this just reads the student's own rows.
 */
export async function getStudentOverview(
  studentId: string,
): Promise<StudentOverview | null> {
  const supabase = await createClient();

  const { data: student } = await supabase
    .from("students")
    .select("account_id, bio, active_course_id")
    .eq("id", studentId)
    .maybeSingle();

  if (!student) return null;

  const [
    { data: parent },
    { data: subscription },
    { data: attendance },
    { data: bookedSlots },
    { data: upcoming },
  ] = await Promise.all([
    supabase
      .from("parents")
      .select("first_name, last_name")
      .eq("account_id", student.account_id)
      .maybeSingle(),
    supabase
      .from("student_subscriptions")
      .select("sessions_remaining, plan_id, status")
      .eq("student_id", studentId)
      .eq("status", "active")
      .maybeSingle(),
    supabase
      .from("session_attendance")
      .select("status, session_date")
      .eq("student_id", studentId)
      .order("session_date", { ascending: false }),
    supabase
      .from("booked_slots")
      .select("weekday, start_time")
      .eq("student_id", studentId)
      .eq("status", "active"),
    supabase
      .from("sessions")
      .select("id, start_time, end_time, reschedule_status")
      .eq("student_id", studentId)
      .gte("start_time", new Date().toISOString())
      .order("start_time", { ascending: true })
      .limit(5),
  ]);

  const streak = computeAttendanceStreak(attendance ?? []);

  // Sessions total comes from the subscription's plan (e.g. 24 classes).
  let sessionsTotal: number | null = null;
  if (subscription?.plan_id) {
    const { data: plan } = await supabase
      .from("plans")
      .select("classes")
      .eq("id", subscription.plan_id)
      .maybeSingle();
    sessionsTotal = plan?.classes ?? null;
  }

  // Preferred time from the active recurring slots (wall-clock + weekday).
  let preferredTime: string | null = null;
  if (bookedSlots && bookedSlots.length > 0) {
    const weekdays = [...new Set(bookedSlots.map((s) => s.weekday))]
      .sort((a, b) => a - b)
      .map((d) => WEEKDAY_ABBR[d] ?? "")
      .filter(Boolean);
    const time = formatWallClock(bookedSlots[0].start_time);
    if (weekdays.length > 0 && time) {
      preferredTime = `${weekdays.join(" & ")}, ${time}`;
    }
  }

  const activeCourse = await loadActiveCourse(
    supabase,
    studentId,
    student.active_course_id,
  );

  return {
    bio: student.bio,
    parentName:
      parent && (parent.first_name || parent.last_name)
        ? `${parent.first_name ?? ""} ${parent.last_name ?? ""}`.trim()
        : null,
    sessionsRemaining: subscription?.sessions_remaining ?? null,
    sessionsTotal,
    streak,
    preferredTime,
    activeCourse,
    upcomingSessions: (upcoming ?? []).filter(
      (s): s is StudentOverviewUpcomingSession => s.start_time != null,
    ),
  };
}

async function loadActiveCourse(
  supabase: Awaited<ReturnType<typeof createClient>>,
  studentId: string,
  activeCourseId: string | null,
): Promise<StudentOverviewActiveCourse | null> {
  if (!activeCourseId) return null;

  const [
    { data: course },
    { data: lessons },
    { data: progress },
    { data: badge },
  ] = await Promise.all([
    supabase
      .from("courses")
      .select("id, title, description, head_lesson_id")
      .eq("id", activeCourseId)
      .maybeSingle(),
    supabase.from("lessons").select("*").eq("course_id", activeCourseId),
    supabase
      .from("lesson_progress")
      .select("lesson_id, status")
      .eq("student_id", studentId),
    supabase
      .from("badges")
      .select("image_url")
      .eq("course_id", activeCourseId)
      .maybeSingle(),
  ]);

  if (!course) return null;

  const ordered = orderLessons(lessons ?? [], course.head_lesson_id);
  const statusByLesson = new Map(
    (progress ?? []).map((p) => [p.lesson_id, p.status]),
  );

  const totalLessons = ordered.length;
  const completedLessons = ordered.filter(
    (l) => statusByLesson.get(l.id) === 3,
  ).length;

  const currentIndex = ordered.findIndex((l) => statusByLesson.get(l.id) !== 3);
  const current = currentIndex >= 0 ? ordered[currentIndex] : null;

  return {
    id: course.id,
    title: course.title,
    description: course.description,
    badgeUrl: badge?.image_url ?? null,
    completedLessons,
    totalLessons,
    currentLessonTitle: current?.title ?? null,
    currentLessonNumber:
      currentIndex >= 0 ? currentIndex + 1 : Math.max(totalLessons, 1),
  };
}
