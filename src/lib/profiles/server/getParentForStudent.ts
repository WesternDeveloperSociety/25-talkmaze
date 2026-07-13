import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/services/supabase/types/database";

type Result =
  | { ok: true; parentId: string }
  | { ok: false; status: 404 | 500; error: string };

/**
 * Resolves the `parents.id` for a student via the shared family `account_id`.
 *
 * Used by both GET /api/students/[studentId] (parent looks up themselves)
 * and GET /api/students/[studentId]/parent (coach looks up the family
 * contact for messaging). The two routes share this helper but apply
 * different auth gates.
 */
export async function getParentIdForStudent(
  supabase: SupabaseClient<Database>,
  studentId: string,
): Promise<Result> {
  const { data: student, error: studentErr } = await supabase
    .from("students")
    .select("account_id")
    .eq("id", studentId)
    .maybeSingle();

  if (studentErr) {
    console.error("getParentIdForStudent: student lookup failed", studentErr);
    return { ok: false, status: 500, error: "Internal server error" };
  }
  if (!student) {
    return { ok: false, status: 404, error: "Student not found" };
  }

  const { data: parentRow, error: parentErr } = await supabase
    .from("parents")
    .select("id")
    .eq("account_id", student.account_id)
    .maybeSingle();

  if (parentErr) {
    console.error("getParentIdForStudent: parent lookup failed", parentErr);
    return { ok: false, status: 500, error: "Internal server error" };
  }
  if (!parentRow) {
    return { ok: false, status: 404, error: "Parent not found" };
  }

  return { ok: true, parentId: parentRow.id };
}
