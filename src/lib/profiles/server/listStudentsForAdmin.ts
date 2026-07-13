import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/services/supabase/types/database";

type AdminStudentRow = {
  id: string;
  account_id: string;
  first_name: string | null;
  last_name: string | null;
  grade: string | null;
  avatar_url: string | null;
  location: string | null;
  date_of_birth: string | null;
  bio: string | null;
  is_setup_complete: boolean | null;
  lesson_space_id: string | null;
  created_at: string;
};

type ListStudentsForAdminResult =
  | { ok: true; students: AdminStudentRow[] }
  | { ok: false; status: number; error: string };

/**
 * Admin leg of GET /api/students: every student row, unscoped.
 *
 * Query moved verbatim from the old admin-audience students handler — the
 * per-role scoping helpers exist so the role-dispatched route never
 * generalizes a WHERE clause (prod runs RLS-disabled).
 */
export async function listStudentsForAdmin(
  supabase: SupabaseClient<Database>,
): Promise<ListStudentsForAdminResult> {
  const { data, error } = await supabase
    .from("students")
    .select(
      "id, account_id, first_name, last_name, grade, avatar_url, location, date_of_birth, bio, is_setup_complete, lesson_space_id, created_at",
    );
  if (error) {
    console.error("students GET error", error);
    return { ok: false, status: 500, error: "Internal server error" };
  }
  return { ok: true, students: data ?? [] };
}
