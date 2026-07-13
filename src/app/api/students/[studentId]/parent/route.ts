import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/src/lib/auth/server/requireRole";
import { assertCoachAssignedToStudent } from "@/src/lib/auth/server/ownership";
import { getParentIdForStudent } from "@/src/lib/profiles/server/getParentForStudent";

const ParamsSchema = z.object({ studentId: z.string().uuid() }).strict();

/**
 * Returns the `parents.id` for a student a coach is linked to.
 *
 * Coach UI uses this to look up the family contact id before opening a
 * conversation via POST /api/conversations with { contactId: <parentId> }.
 *
 * Auth: coach role (2) + coach_students ownership of the student.
 * Same response shape as GET /api/students/[studentId] so callers can
 * share handling.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ studentId: string }> },
) {
  // Stage 1: AUTH
  const auth = await requireRole([2]);
  if (auth instanceof NextResponse) return auth;
  const { supabase } = auth;

  // Stage 2: VALIDATE
  const parsed = ParamsSchema.safeParse(await params);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request parameters", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { studentId } = parsed.data;

  // Stage 3: AUTHORIZE
  const ownership = await assertCoachAssignedToStudent(auth, studentId);
  if (ownership instanceof NextResponse) return ownership;

  // Stage 4: EXECUTE
  try {
    const result = await getParentIdForStudent(supabase, studentId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ parent: { id: result.parentId } });
  } catch (err) {
    console.error("students/[studentId]/parent GET error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
