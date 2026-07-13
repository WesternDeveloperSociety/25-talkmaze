import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/src/lib/auth/server/requireRole";
import { assertOwnsStudent } from "@/src/lib/auth/server/ownership";
import { setActiveCourse } from "@/src/lib/lessons/server/setActiveCourse";

const ParamsSchema = z.object({ studentId: z.string().uuid() }).strict();

const BodySchema = z
  .object({
    courseId: z.string().uuid().nullable(),
  })
  .strict();

/**
 * Sets the student's currently active course. Used by the family-side
 * course picker on student home, /lessons, etc.
 *
 * Auth: family role (1) + the student must belong to the calling account.
 * The setActiveCourse helper additionally validates that an active
 * course_assignment exists for the requested course.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> },
) {
  // Stage 1: AUTH
  const auth = await requireRole([1]);
  if (auth instanceof NextResponse) return auth;
  const { supabase } = auth;

  // Stage 2: VALIDATE
  const parsedParams = ParamsSchema.safeParse(await params);
  if (!parsedParams.success) {
    return NextResponse.json(
      {
        error: "Invalid request parameters",
        details: parsedParams.error.flatten(),
      },
      { status: 400 },
    );
  }
  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { studentId } = parsedParams.data;
  const { courseId } = parsed.data;

  // Stage 3: AUTHORIZE
  const ownership = await assertOwnsStudent(auth, studentId);
  if (ownership instanceof NextResponse) return ownership;

  // Stage 4: EXECUTE
  try {
    const result = await setActiveCourse(supabase, studentId, courseId);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("students/[studentId]/active-course PATCH error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
