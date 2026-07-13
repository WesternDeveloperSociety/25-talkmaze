import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/services/supabase/types/database";

type CoachSessionRow = {
  id: number;
  start_time: string | null;
  end_time: string | null;
  weekday: number | null;
  student_id: string | null;
  requested_start_time: string | null;
  requested_end_time: string | null;
  reschedule_status: string | null;
  students: { first_name: string | null; last_name: string | null } | null;
};

type ListSessionsForCoachResult =
  | { ok: true; sessions: CoachSessionRow[] }
  | { ok: false; status: number; error: string };

/**
 * Coach leg of GET /api/sessions: only the sessions assigned to the calling
 * coach, after resolving the coach's own row from their account id.
 *
 * The optional `studentId` filter is implicit scoping, not authorization —
 * per docs/api-ownership.md, a student_id belonging to a different coach
 * yields an empty list (silent scope, no information leak), NOT a 403.
 *
 * The coach row lookup is a DATA lookup, not auth (requireRole([2]) already
 * proved role). Missing row despite role=2 is data inconsistency → 500.
 *
 * Queries moved verbatim from the old coach-audience sessions handler — the
 * per-role scoping helpers exist so the role-dispatched route never
 * generalizes a WHERE clause (prod runs RLS-disabled).
 */
export async function listSessionsForCoach(
  supabase: SupabaseClient<Database>,
  accountId: string,
  studentId?: string,
): Promise<ListSessionsForCoachResult> {
  const { data: coach } = await supabase
    .from("coaches")
    .select("id")
    .eq("account_id", accountId)
    .maybeSingle();
  if (!coach) {
    console.error("sessions GET: role=2 but no coaches row", {
      userId: accountId,
    });
    return { ok: false, status: 500, error: "Coach record missing" };
  }

  let query = supabase
    .from("sessions")
    .select(
      "id, start_time, end_time, weekday, student_id, requested_start_time, requested_end_time, reschedule_status, students(first_name, last_name)",
    )
    .eq("coach_id", coach.id)
    .order("start_time", { ascending: true });

  if (studentId) {
    query = query.eq("student_id", studentId);
  }

  const { data: sessions, error } = await query;
  if (error) {
    console.error("sessions GET query error", error);
    return { ok: false, status: 500, error: "Internal server error" };
  }

  return { ok: true, sessions: sessions ?? [] };
}
