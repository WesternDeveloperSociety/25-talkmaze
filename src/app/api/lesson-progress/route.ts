import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/src/lib/auth/server/requireRole";
import { assertCoachAssignedToStudent } from "@/src/lib/auth/server/ownership";
import { awardProgress } from "@/src/lib/lessons/server/awardProgress";

export async function GET(_req: Request) {
  const auth = await requireRole([1, 2, 3]);
  if (auth instanceof NextResponse) return auth;
  const { supabase, user } = auth;

  try {
    const { data: student } = await supabase
      .from("students")
      .select("id")
      .eq("account_id", user.id)
      .maybeSingle();
    if (!student) {
      return NextResponse.json(
        { error: "Student profile not found" },
        { status: 404 },
      );
    }

    const [completed, total] = await Promise.all([
      supabase
        .from("lesson_progress")
        .select("*", { count: "exact", head: true })
        .eq("student_id", student.id)
        .eq("status", 1),
      supabase.from("lessons").select("*", { count: "exact", head: true }),
    ]);
    if (completed.error || total.error) {
      console.error(
        "lesson-progress count error",
        completed.error ?? total.error,
      );
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }
    return NextResponse.json({
      completed: completed.count ?? 0,
      total: total.count ?? 24,
      studentId: student.id,
    });
  } catch (err: unknown) {
    console.error("lesson-progress error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

const PatchBodySchema = z
  .object({
    student_id: z.string().uuid(),
    lesson_id: z.string().uuid(),
    status: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  })
  .strict();

export async function PATCH(request: Request) {
  // Stage 1: AUTH
  const auth = await requireRole([2]);
  if (auth instanceof NextResponse) return auth;
  const { supabase } = auth;

  // Stage 2: VALIDATE
  const parsed = PatchBodySchema.safeParse(
    await request.json().catch(() => ({})),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Stage 3: AUTHORIZE
  const ownership = await assertCoachAssignedToStudent(
    auth,
    parsed.data.student_id,
  );
  if (ownership instanceof NextResponse) return ownership;

  // Stage 4: EXECUTE — token + badge cascade lives in
  // src/lib/lessons/server/awardProgress (extracted per
  // api-contract.md §domain-logic-placement).
  try {
    const result = await awardProgress(supabase, parsed.data);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }
    return NextResponse.json(result.row);
  } catch (err: unknown) {
    console.error("lesson-progress PATCH error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
