import "server-only";

import { cache } from "react";
import { getCurrentUser } from "@/src/lib/auth/server/getCurrentUser";
import { createClient } from "@/src/services/supabase/server";
import type { Database } from "@/src/services/supabase/types/database";

type Student = Database["public"]["Tables"]["students"]["Row"];

/** A student row plus the title of their active course (for the list subtitle). */
export type CoachStudent = Student & {
  activeCourseTitle: string | null;
  hasActiveSubscription: boolean;
};

interface CoachAccount {
  id: string;
  email: string;
}

export interface CoachDashboardContext {
  account: CoachAccount;
  students: CoachStudent[];
}

/**
 * Fetches the authenticated coach's account identity plus assigned students
 * (each annotated with its active-course title). Used by the coach student
 * layout for the persistent "My Students" sidebar, plus URL-driven selection
 * and redirects across every tab route.
 *
 * `cache()`-wrapped so the shared layout and its child page resolve the list
 * from a single set of queries within one request.
 */
export const getCoachDashboardContext = cache(
  async (): Promise<CoachDashboardContext> => {
    const user = await getCurrentUser();
    if (!user) throw new Error("User not found");

    const supabase = await createClient();

    const [{ data: account }, { data: coachData }] = await Promise.all([
      supabase.from("account").select("id, email").eq("id", user.id).single(),
      supabase.from("coaches").select("id").eq("account_id", user.id).single(),
    ]);

    if (!account) throw new Error("Account not found");
    if (!coachData) throw new Error("Coach profile not found");

    const { data: assignments, error: assignmentsError } = await supabase
      .from("coach_students")
      .select("students(*)")
      .eq("coach_id", coachData.id);

    if (assignmentsError) {
      throw new Error(assignmentsError.message);
    }

    // Sort deterministically by name. Without an ORDER BY Postgres can return
    // rows in different orders across requests, which makes the student-list
    // pagination snap to a different page on every navigation (e.g. clicking
    // a student would seem to "reset" the list because the same student now
    // lives at a different index, and therefore a different page).
    const sorted = (
      (assignments ?? [])
        .map((row) => row.students)
        .filter(Boolean) as Student[]
    ).sort((a, b) => {
      const aName = `${a.first_name ?? ""} ${a.last_name ?? ""}`.toLowerCase();
      const bName = `${b.first_name ?? ""} ${b.last_name ?? ""}`.toLowerCase();
      if (aName !== bName) return aName < bName ? -1 : 1;
      return a.id < b.id ? -1 : 1;
    });

    // Resolve active-course titles + active-subscription status in two batched
    // queries (run in parallel) for the list subtitle and status dot.
    const courseIds = [
      ...new Set(
        sorted
          .map((s) => s.active_course_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const studentIds = sorted.map((s) => s.id);

    const [{ data: courses }, { data: activeSubs }] = await Promise.all([
      courseIds.length > 0
        ? supabase.from("courses").select("id, title").in("id", courseIds)
        : Promise.resolve({ data: [] as { id: string; title: string }[] }),
      studentIds.length > 0
        ? supabase
            .from("student_subscriptions")
            .select("student_id")
            .in("student_id", studentIds)
            .eq("status", "active")
        : Promise.resolve({ data: [] as { student_id: string }[] }),
    ]);

    const courseTitleById = new Map<string, string>();
    for (const c of courses ?? []) courseTitleById.set(c.id, c.title);

    const activeSubStudentIds = new Set<string>();
    for (const sub of activeSubs ?? []) activeSubStudentIds.add(sub.student_id);

    const students: CoachStudent[] = sorted.map((s) => ({
      ...s,
      activeCourseTitle: s.active_course_id
        ? (courseTitleById.get(s.active_course_id) ?? null)
        : null,
      hasActiveSubscription: activeSubStudentIds.has(s.id),
    }));

    return {
      account: {
        id: account.id,
        email: account.email,
      },
      students,
    };
  },
);
