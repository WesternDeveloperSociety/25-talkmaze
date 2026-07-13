import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/services/supabase/types/database";

type ParentStudentRow = {
  id: string;
  name: string;
  first_name: string | null;
  last_name: string | null;
  grade: string | null;
  avatar_url: string | null;
  location: string | null;
  date_of_birth: string | null;
  bio: string | null;
  remaining_lessons: number;
  status: string;
};

type ListStudentsForParentResult =
  | { ok: true; students: ParentStudentRow[] }
  | { ok: false; status: number; error: string };

/**
 * Parent leg of GET /api/students: the calling account's own students, with
 * their subscription status folded into a family-facing DTO.
 *
 * Query + mapping moved verbatim from the old parent-audience students
 * handler — the per-role scoping helpers exist so the role-dispatched route
 * never generalizes a WHERE clause (prod runs RLS-disabled).
 */
export async function listStudentsForParent(
  supabase: SupabaseClient<Database>,
  accountId: string,
): Promise<ListStudentsForParentResult> {
  const { data: students, error: studentError } = await supabase
    .from("students")
    .select(
      `
      id,
      first_name,
      last_name,
      grade,
      avatar_url,
      location,
      date_of_birth,
      bio,
      student_subscriptions (
        sessions_remaining,
        status
      )
    `,
    )
    .eq("account_id", accountId);

  if (studentError) {
    console.error("students GET fetch error", studentError);
    return { ok: false, status: 500, error: "Internal server error" };
  }

  const studentList = (students ?? []).map((s) => {
    const subscription = s.student_subscriptions?.[0] || null;
    return {
      id: s.id,
      name: `${s.first_name || ""} ${s.last_name || ""}`.trim(),
      first_name: s.first_name,
      last_name: s.last_name,
      grade: s.grade,
      avatar_url: s.avatar_url,
      location: s.location,
      date_of_birth: s.date_of_birth,
      bio: s.bio,
      remaining_lessons: subscription?.sessions_remaining ?? 0,
      status: subscription?.status || "inactive",
    };
  });

  return { ok: true, students: studentList };
}
