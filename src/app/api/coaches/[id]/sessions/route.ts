import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/src/lib/auth/server/requireRole";

/**
 * All sessions for one coach, with the student name embedded - feeds the
 * admin coach-detail calendar. A valid-but-unknown coach id returns 200 with
 * an empty collection (matches the availability sibling: admin role is the
 * authorization, so there is no existence probe).
 */

const ParamsSchema = z.object({ id: z.string().uuid() }).strict();

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
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
      .from("sessions")
      .select(
        "id, start_time, end_time, student_id, students(first_name, last_name)",
      )
      .eq("coach_id", parsed.data.id);

    if (error) {
      console.error("coaches/[id]/sessions GET error", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }
    return NextResponse.json({ sessions: data ?? [] });
  } catch (err: unknown) {
    console.error("coaches/[id]/sessions GET error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
