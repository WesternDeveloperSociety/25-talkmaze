import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/src/lib/auth/server/requireRole";
import { assertCoachAssignedToStudent } from "@/src/lib/auth/server/ownership";
import { reconcileActiveCourseAfterUnassign } from "@/src/lib/lessons/server/setActiveCourse";

const ParamsSchema = z
  .object({
    courseId: z.string().uuid(),
    studentId: z.string().uuid(),
  })
  .strict();

/**
 * Soft-deletes a course assignment by setting isActive=false. Idempotent —
 * returns success even if the assignment doesn't exist or is already inactive.
 * Lesson_progress rows are preserved so a later re-assignment resumes
 * progress.
 *
 * Auth: coach role (2) with coach_students ownership of the student, or
 * admin role (3) with no ownership check.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ courseId: string; studentId: string }> },
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
  const { courseId, studentId } = parsed.data;

  // Stage 3: AUTHORIZE — coaches must be linked to the student; admins bypass.
  if (account.role === 2) {
    const ownership = await assertCoachAssignedToStudent(auth, studentId);
    if (ownership instanceof NextResponse) return ownership;
  }

  // Stage 4: EXECUTE — soft delete via isActive=false. Idempotent.
  try {
    const { error } = await supabase
      .from("course_assignment")
      .update({ isActive: false })
      .eq("student_id", studentId)
      .eq("course_id", courseId)
      .eq("isActive", true);
    if (error) {
      console.error("courses/[courseId]/students/[studentId] DELETE error", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }
    await reconcileActiveCourseAfterUnassign(supabase, studentId, courseId);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("courses/[courseId]/students/[studentId] DELETE error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
