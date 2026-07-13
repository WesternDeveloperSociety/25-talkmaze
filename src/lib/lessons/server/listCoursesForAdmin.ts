import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/services/supabase/types/database";

type AdminCourseRow = {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
};

type ListCoursesForAdminResult =
  | { ok: true; courses: AdminCourseRow[] }
  | { ok: false; status: number; error: string };

/**
 * Admin leg of GET /api/courses: the raw course catalog, unscoped.
 *
 * Query moved verbatim from the old admin-audience courses handler — the
 * per-role scoping helpers exist so the role-dispatched route never
 * generalizes a WHERE clause (prod runs RLS-disabled).
 */
export async function listCoursesForAdmin(
  supabase: SupabaseClient<Database>,
): Promise<ListCoursesForAdminResult> {
  const { data, error } = await supabase
    .from("courses")
    .select("id, title, description, created_at");

  if (error) {
    console.error("courses GET error", error);
    return { ok: false, status: 500, error: "Internal server error" };
  }

  return { ok: true, courses: data ?? [] };
}
