import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/src/lib/auth/server/requireRole";
import { assertCoachAssignedToStudent } from "@/src/lib/auth/server/ownership";

const QuerySchema = z
  .object({
    studentId: z.string().uuid().optional(),
  })
  .strict();

export async function GET(request: Request) {
  // Stage 1: AUTH
  const auth = await requireRole([2]);
  if (auth instanceof NextResponse) return auth;
  const { supabase } = auth;

  // Stage 2: VALIDATE
  const parsed = QuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid request parameters",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }
  const { studentId } = parsed.data;

  // Stage 3: AUTHORIZE (only when studentId is present)
  if (studentId) {
    const ownership = await assertCoachAssignedToStudent(auth, studentId);
    if (ownership instanceof NextResponse) return ownership;
  }

  // Stage 4: EXECUTE
  try {
    const { data: lessons, error: lessonsError } = await supabase
      .from("lessons")
      .select(`
        id,
        title,
        description,
        content_url,
        created_at,
        updated_at,
        courses!lessons_course_id_fkey(id, title)
      `)
      .order("created_at", { ascending: false });

    if (lessonsError) {
      console.error("lessons GET query error", lessonsError);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }

    let result: Array<Record<string, unknown>> = (lessons ?? []).map((l) => ({
      ...l,
      progress: null as unknown,
    }));

    if (studentId) {
      const { data: progressRows, error: progressError } = await supabase
        .from("lesson_progress")
        .select("lesson_id, status, completed_at, coach_notes")
        .eq("student_id", studentId);

      if (progressError) {
        console.error("lessons GET progress query error", progressError);
        return NextResponse.json(
          { error: "Internal server error" },
          { status: 500 },
        );
      }

      const progressMap = new Map(
        (progressRows ?? []).map((p) => [p.lesson_id, p]),
      );
      result = result.map((l) => ({
        ...l,
        progress: progressMap.get(l.id as string) ?? null,
      }));
    }

    return NextResponse.json({ lessons: result });
  } catch (err: unknown) {
    console.error("lessons GET error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
