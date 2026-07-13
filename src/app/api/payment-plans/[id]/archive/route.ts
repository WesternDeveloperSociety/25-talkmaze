import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/src/lib/auth/server/requireRole";

const ParamsSchema = z.object({ id: z.string().uuid() }).strict();

export async function POST(
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
    const { data: plan, error } = await supabase
      .from("plans")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", parsed.data.id)
      .select()
      .maybeSingle();

    if (error) {
      console.error("payment-plans/[id]/archive POST error", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }
    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }
    return NextResponse.json({ plan });
  } catch (err: unknown) {
    console.error("payment-plans/[id]/archive POST error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
