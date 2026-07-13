import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/src/lib/auth/server/requireRole";
import { assertOwnsStudent } from "@/src/lib/auth/server/ownership";
import { getParentIdForStudent } from "@/src/lib/profiles/server/getParentForStudent";
import type { TablesUpdate } from "@/src/services/supabase/types/database";

const ParamsSchema = z.object({ studentId: z.string().uuid() }).strict();

const PatchBodySchema = z
  .object({
    student: z
      .object({
        first_name: z.string().nullable().optional(),
        last_name: z.string().nullable().optional(),
        date_of_birth: z.string().nullable().optional(),
        grade: z.string().nullable().optional(),
        location: z.string().nullable().optional(),
        bio: z.string().nullable().optional(),
        avatar_url: z.string().nullable().optional(),
        lesson_space_id: z.string().nullable().optional(),
        lesson_space_student_link: z.string().nullable().optional(),
        lesson_space_teacher_link: z.string().nullable().optional(),
        post_lesson_days: z.number().int().optional(),
        post_lesson_tasks_enabled: z.boolean().optional(),
        notes: z.string().nullable().optional(),
      })
      .strict(),
  })
  .strict();

/**
 * GET /api/students/[studentId]
 *
 * Resolves the parent record for a given student. Family-side only.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ studentId: string }> },
) {
  // Stage 1: AUTH
  const auth = await requireRole([1]);
  if (auth instanceof NextResponse) return auth;
  const { supabase } = auth;

  // Stage 2: VALIDATE
  const parsed = ParamsSchema.safeParse(await params);
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

  // Stage 3: AUTHORIZE
  const ownership = await assertOwnsStudent(auth, studentId);
  if (ownership instanceof NextResponse) return ownership;

  // Stage 4: EXECUTE
  try {
    const result = await getParentIdForStudent(supabase, studentId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ parent: { id: result.parentId } });
  } catch (err: unknown) {
    console.error("students/[studentId] GET error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/students/[studentId]
 *
 * Admin-only partial update of a student row.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ studentId: string }> },
) {
  const auth = await requireRole([3]);
  if (auth instanceof NextResponse) return auth;
  const { supabase } = auth;

  const parsedParams = ParamsSchema.safeParse(await params);
  if (!parsedParams.success) {
    return NextResponse.json(
      { error: "Invalid request parameters", details: parsedParams.error.flatten() },
      { status: 400 },
    );
  }
  const parsedBody = PatchBodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsedBody.error.flatten() },
      { status: 400 },
    );
  }

  const payload: TablesUpdate<"students"> = {};
  for (const [k, v] of Object.entries(parsedBody.data.student)) {
    if (v !== undefined) (payload as Record<string, unknown>)[k] = v;
  }

  try {
    if (Object.keys(payload).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 },
      );
    }
    const { data, error } = await supabase
      .from("students")
      .update(payload)
      .eq("id", parsedParams.data.studentId)
      .select()
      .maybeSingle();
    if (error) {
      console.error("students/[studentId] PATCH error", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }
    if (!data) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }
    return NextResponse.json({ student: data });
  } catch (err: unknown) {
    console.error("students/[studentId] PATCH error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
