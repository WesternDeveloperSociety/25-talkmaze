import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/services/supabase/types/database";

type ParentSessionRow = {
  id: number;
  start_time: string | null;
  end_time: string | null;
  weekday: number | null;
  student_id: string | null;
  coach_id: string | null;
  requested_start_time: string | null;
  requested_end_time: string | null;
  reschedule_status: string | null;
  students: { first_name: string | null; last_name: string | null } | null;
  coaches: { first_name: string | null; last_name: string | null } | null;
};

type ListSessionsForParentResult =
  | { ok: true; sessions: ParentSessionRow[] }
  | { ok: false; status: number; error: string };

/**
 * Parent leg of GET /api/sessions: every session belonging to the calling
 * account's students.
 *
 * Queries moved verbatim from the old parent-audience sessions handler — the
 * per-role scoping helpers exist so the role-dispatched route never
 * generalizes a WHERE clause (prod runs RLS-disabled).
 */
export async function listSessionsForParent(
  supabase: SupabaseClient<Database>,
  accountId: string,
): Promise<ListSessionsForParentResult> {
  const { data: students, error: studentError } = await supabase
    .from("students")
    .select("id")
    .eq("account_id", accountId);

  if (studentError) {
    console.error("sessions GET student lookup error", studentError);
    return { ok: false, status: 500, error: "Internal server error" };
  }

  if (!students || students.length === 0) {
    return { ok: true, sessions: [] };
  }

  const studentIds = students.map((s) => s.id);

  // coaches(first_name, last_name): the old route selected the nonexistent
  // coaches(name) column and 500ed on every call — sanctioned fix on move.
  const { data: sessions, error: sessionError } = await supabase
    .from("sessions")
    .select(
      `
      id,
      start_time,
      end_time,
      weekday,
      student_id,
      coach_id,
      requested_start_time,
      requested_end_time,
      reschedule_status,
      students (first_name, last_name),
      coaches (first_name, last_name)
    `,
    )
    .in("student_id", studentIds)
    .order("start_time", { ascending: true });

  if (sessionError) {
    console.error("sessions GET fetch error", sessionError);
    return { ok: false, status: 500, error: "Internal server error" };
  }

  return { ok: true, sessions: sessions ?? [] };
}
