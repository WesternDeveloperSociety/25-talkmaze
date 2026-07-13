import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/src/lib/auth/server/requireRole";
import { assertCoachAssignedToStudent } from "@/src/lib/auth/server/ownership";
import { getStudentLessonsByCourse } from "@/src/lib/lessons/server/getStudentLessonsByCourse";

const ParamsSchema = z.object({ studentId: z.string().uuid() }).strict();

/**
 * Returns the student's lessons grouped by course.
 *
 * Auth: role-dispatched. Admin (3) is authorized by role alone; coach (2)
 * additionally needs coach_students ownership of the student. Both legs
 * delegate to the same src/lib helper and share the { courses } shape.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ studentId: string }> },
) {
  // Stage 1: AUTH
  const auth = await requireRole([2, 3]);
  if (auth instanceof NextResponse) return auth;
  const { account, supabase } = auth;

  // Stage 2: VALIDATE
  const parsed = ParamsSchema.safeParse(await params);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request parameters", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { studentId } = parsed.data;

  // Stage 3: AUTHORIZE (coach leg only — admin role is the authorization)
  if (account.role === 2) {
    const ownership = await assertCoachAssignedToStudent(auth, studentId);
    if (ownership instanceof NextResponse) return ownership;
  }

  // Stage 4: EXECUTE
  try {
    const courses = await getStudentLessonsByCourse(supabase, studentId);
    return NextResponse.json({ courses });
  } catch (err: unknown) {
    console.error("students/[studentId]/lessons GET error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
