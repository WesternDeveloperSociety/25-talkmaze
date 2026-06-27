import { redirect } from "next/navigation";
import { createClient } from "@/src/services/supabase/server";
import ParentDashboardClient, {
  Student,
} from "./_components/ParentDashboardClient";
import { AttendanceItem } from "./_components/StudentAttendanceDetails";
import type { CoachingSession } from "@/src/lib/scheduling/types";
import { fullName } from "@/src/utils/formatName";
import { computeAttendanceStreak } from "@/src/utils/attendanceStreak";
import { getCurrentUser } from "@/src/lib/auth/server/getCurrentUser";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Parent Dashboard" };

/**
 * Top-level page component for Parent Dashboard Home
 * Fetches all the required data, and passes it to the client component
 */
export default async function ParentDashboard() {
  const supabase = await createClient();

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Fetch students for this account
  const { data: studentsRaw } = await supabase
    .from("students")
    .select(
      `id, first_name, last_name, grade, avatar_url, location, date_of_birth, bio, is_setup_complete,
       student_subscriptions(sessions_remaining, status, plans!plan_id(classes))`,
    )
    .eq("account_id", user.id);

  const students: Student[] = (studentsRaw ?? []).map((s: any) => {
    const subscription = s.student_subscriptions?.[0] ?? null;
    return {
      id: s.id,
      name: fullName(s.first_name, s.last_name),
      first_name: s.first_name,
      last_name: s.last_name,
      grade: s.grade,
      avatar_url: s.avatar_url,
      location: s.location,
      date_of_birth: s.date_of_birth,
      bio: s.bio,
      remaining_lessons: subscription?.sessions_remaining ?? 0,
      total_lessons: subscription?.plans?.classes ?? 0,
      status: subscription?.status ?? "inactive",
      is_setup_complete: s.is_setup_complete,
    };
  });

  // Fetch upcoming sessions for these students
  const studentIds = students.map((s) => s.id);
  let schedule: CoachingSession[] = [];

  if (studentIds.length > 0) {
    const now = new Date().toISOString();

    const { data: sessions, error: sessionsError } = await supabase
      .from("sessions")
      .select(
        `id, start_time, end_time, student_id,
         students(first_name),
         coaches(first_name, last_name)`,
      )
      .in("student_id", studentIds)
      .gte("start_time", now)
      .order("start_time", { ascending: true });

    if (sessionsError) {
      console.error(
        "[ParentDashboard] Failed to fetch sessions:",
        sessionsError.message,
        { code: sessionsError.code, details: sessionsError.details },
      );
    }
    schedule = (sessions ?? []).map((session: any) => ({
      id: session.id.toString(),
      title: "Public Speaking Session",
      start_date: session.start_time,
      end_date: session.end_time,
      description: "",
      student_id: session.student_id,
      studentName: session.students?.first_name ?? "Student",
      coachName: session.coaches
        ? fullName(session.coaches.first_name, session.coaches.last_name)
        : "",
      status: "scheduled",
    }));
  }

  // Fetch attendance for all students
  const attendanceByStudent: Record<string, AttendanceItem[]> = {};
  const streakByStudent: Record<string, number> = {};

  if (studentIds.length > 0) {
    const { data: attendanceRaw } = await supabase
      .from("session_attendance")
      .select(
        "student_id, session_date, session_id, status, coaches(first_name, last_name)",
      )
      .in("student_id", studentIds)
      .order("session_date", { ascending: false });

    // Hide sessions that have already been marked by a coach
    const markedSessionIds = new Set(
      (attendanceRaw ?? [])
        .filter((r: any) => r.session_id != null)
        .map((r: any) => r.session_id as number),
    );
    schedule = schedule.filter((s) => !markedSessionIds.has(Number(s.id)));

    for (const student of students) {
      // Full attendance history for this student (newest first).
      const studentRecords = (attendanceRaw ?? []).filter(
        (r) => r.student_id === student.id,
      );

      streakByStudent[student.id] = computeAttendanceStreak(studentRecords);

      // Display tracker shows the most recent 12 records as fixed slots
      const records = studentRecords.slice(0, 12);

      // Build display array: oldest first, padded with "future" slots to fill 12
      const pastItems: AttendanceItem[] = [...records].reverse().map((r) => {
        const coach = r.coaches as any;
        const coachName = coach
          ? fullName(coach.first_name, coach.last_name) || null
          : null;
        return {
          status: r.status as AttendanceItem["status"],
          session_date: r.session_date,
          coach_name: coachName,
        };
      });

      const futureCount = Math.max(0, 12 - pastItems.length);
      const futureItems: AttendanceItem[] = Array.from(
        { length: futureCount },
        () => ({ status: "future" as const }),
      );

      attendanceByStudent[student.id] = [...pastItems, ...futureItems];
    }
  }

  return (
    <ParentDashboardClient
      students={students}
      schedule={schedule}
      attendanceByStudent={attendanceByStudent}
      streakByStudent={streakByStudent}
    />
  );
}
