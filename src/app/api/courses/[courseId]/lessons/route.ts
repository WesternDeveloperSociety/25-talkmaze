import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/src/lib/auth/server/requireRole";
import { insertLessonIntoCourse } from "@/src/lib/lessons/server/insertLessonIntoCourse";

const ParamsSchema = z.object({ courseId: z.string().uuid() }).strict();

const PostBodySchema = z
  .object({
    lesson_id: z.string().uuid(),
    title: z.string().min(1),
    description: z.string().optional(),
    content_url: z.string().optional(),
    pre_file_name: z.string().optional(),
    post_file_name: z.string().optional(),
    slide_pdf_name: z.string().optional(),
    slide_pptx_name: z.string().optional(),
    pre_lesson_description: z.string().optional(),
    post_lesson_description: z.string().optional(),
  })
  .strict();

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ courseId: string }> },
) {
  const auth = await requireRole([3]);
  if (auth instanceof NextResponse) return auth;
  const { supabase } = auth;

  const parsed = ParamsSchema.safeParse(await params);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request parameters", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const { data, error } = await supabase
      .from("lessons")
      .select(
        "id, title, description, content_url, slug, course_id, created_at, slide_show_url, slide_pptx_url, prev_lesson, next_lesson",
      )
      .eq("course_id", parsed.data.courseId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("courses/[courseId]/lessons GET error", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }
    return NextResponse.json({ lessons: data ?? [] });
  } catch (err: unknown) {
    console.error("courses/[courseId]/lessons GET error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ courseId: string }> },
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
  const parsedBody = PostBodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsedBody.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const result = await insertLessonIntoCourse(supabase, {
      course_id: parsedParams.data.courseId,
      ...parsedBody.data,
    });
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }
    return NextResponse.json({ lesson: result.lesson }, { status: 201 });
  } catch (err: unknown) {
    console.error("courses/[courseId]/lessons POST error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
