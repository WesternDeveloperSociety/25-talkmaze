import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/src/lib/auth/server/requireRole";
import { assertCoachAssignedToStudent } from "@/src/lib/auth/server/ownership";

/**
 * PATCH /api/lesson-progress/feedback
 *
 * Saves (or creates) a coach's written feedback for a student/lesson pair.
 * Uses upsert so can call this repeatedly without creating duplicate rows.
 *
 * Both feedback fields are HTML strings produced by Tiptap's FeedbackEditor.
 */
const BodySchema = z
  .object({
    student_id: z.string().uuid(),
    lesson_id: z.string().uuid(),
    positive_feedback: z.string().optional(),
    improvement_feedback: z.string().optional(),
  })
  .strict();

export async function PATCH(request: Request) {
  // Stage 1: AUTH
  const auth = await requireRole([2]);
  if (auth instanceof NextResponse) return auth;
  const { supabase } = auth;

  // Stage 2: VALIDATE
  const parsed = BodySchema.safeParse(
    await request.json().catch(() => ({})),
  );
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid request body",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }
  const { student_id, lesson_id, positive_feedback, improvement_feedback } =
    parsed.data;

  // Stage 3: AUTHORIZE
  const ownership = await assertCoachAssignedToStudent(auth, student_id);
  if (ownership instanceof NextResponse) return ownership;

  // Stage 4: EXECUTE
  try {
    const { data, error } = await supabase
      .from("lesson_progress")
      .upsert(
        {
          student_id,
          lesson_id,
          positive_feedback: positive_feedback ?? null,
          improvement_feedback: improvement_feedback ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "student_id,lesson_id" },
      )
      .select()
      .single();

    if (error) {
      console.error("lesson-progress/feedback PATCH upsert error", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }

    return NextResponse.json(data);
  } catch (err: unknown) {
    console.error("lesson-progress/feedback PATCH error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
