import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/services/supabase/types/database";

type CoachStudentRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  lesson_space_id: string | null;
};

type ListStudentsForCoachResult =
  | { ok: true; students: CoachStudentRow[] }
  | { ok: false; status: number; error: string };

/**
 * Coach leg of GET /api/students: only the students linked to the calling
 * coach via the coach_students junction, after resolving the coach's own
 * row from their account id.
 *
 * Queries moved verbatim from the old coach-audience students handler — the
 * per-role scoping helpers exist so the role-dispatched route never
 * generalizes a WHERE clause (prod runs RLS-disabled).
 */
export async function listStudentsForCoach(
  supabase: SupabaseClient<Database>,
  accountId: string,
): Promise<ListStudentsForCoachResult> {
  const { data: coachData, error: coachError } = await supabase
    .from("coaches")
    .select("id")
    .eq("account_id", accountId)
    .maybeSingle();

  if (coachError) {
    console.error("students GET coach lookup error", coachError);
    return { ok: false, status: 500, error: "Internal server error" };
  }
  if (!coachData) {
    console.error("students GET: role=2 but no coaches row", {
      userId: accountId,
    });
    return { ok: false, status: 500, error: "Coach record missing" };
  }

  const { data: assignments, error: assignmentsError } = await supabase
    .from("coach_students")
    .select(
      `
      student_id,
      students(
        id,
        first_name,
        last_name,
        lesson_space_id
      )
    `,
    )
    .eq("coach_id", coachData.id);

  if (assignmentsError) {
    console.error("students GET query error", assignmentsError);
    return { ok: false, status: 500, error: "Internal server error" };
  }

  const students = (assignments ?? []).map((a) => a.students).filter(Boolean);
  return { ok: true, students };
}
