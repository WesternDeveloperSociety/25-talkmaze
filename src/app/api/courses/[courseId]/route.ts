import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/src/lib/auth/server/requireRole";

const ParamsSchema = z.object({ courseId: z.string().uuid() }).strict();

const PatchBodySchema = z
  .object({
    course: z
      .object({
        title: z.string().min(1).optional(),
        description: z.string().nullable().optional(),
      })
      .strict(),
  })
  .strict();

export async function PATCH(
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
  const parsedBody = PatchBodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsedBody.error.flatten() },
      { status: 400 },
    );
  }

  const payload: { title?: string; description?: string | null } = {};
  if (parsedBody.data.course.title !== undefined) payload.title = parsedBody.data.course.title;
  if (parsedBody.data.course.description !== undefined) {
    payload.description = parsedBody.data.course.description;
  }

  try {
    if (Object.keys(payload).length === 0) {
      return NextResponse.json({ course: null });
    }
    const { data, error } = await supabase
      .from("courses")
      .update(payload)
      .eq("id", parsedParams.data.courseId)
      .select("id, title, description, created_at")
      .single();
    if (error) {
      console.error("courses PATCH error", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }
    return NextResponse.json({ course: data });
  } catch (err: unknown) {
    console.error("courses PATCH error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
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
    const { error } = await supabase
      .from("courses")
      .delete()
      .eq("id", parsed.data.courseId);
    if (error) {
      console.error("courses DELETE error", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("courses DELETE error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
