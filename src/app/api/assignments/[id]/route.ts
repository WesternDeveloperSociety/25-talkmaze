import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/src/lib/auth/server/requireRole";

// Composite id format: `<coach_uuid>_<student_uuid>`.
const ParamsSchema = z
  .object({
    id: z
      .string()
      .regex(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
        "Composite id must be `<coach_uuid>_<student_uuid>`",
      ),
  })
  .strict();

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRole([3]);
  if (auth instanceof NextResponse) return auth;
  const { supabase } = auth;

  const parsed = ParamsSchema.safeParse(await params);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid assignment id", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const [coach_id, student_id] = parsed.data.id.split("_");

  try {
    const { error } = await supabase
      .from("coach_students")
      .delete()
      .eq("coach_id", coach_id)
      .eq("student_id", student_id);

    if (error) {
      console.error("assignments DELETE error", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("assignments DELETE error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
