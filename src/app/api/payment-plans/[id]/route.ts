import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/src/lib/auth/server/requireRole";
import type { TablesUpdate } from "@/src/services/supabase/types/database";

const ParamsSchema = z.object({ id: z.string().uuid() }).strict();

const PatchBodySchema = z
  .object({
    name: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
    classes: z.number().int().positive().optional(),
    renewal: z.string().min(1).optional(),
    type: z.string().nullable().optional(),
  })
  .strict();

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
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

  const updates: TablesUpdate<"plans"> = { updated_at: new Date().toISOString() };
  for (const [k, v] of Object.entries(parsedBody.data)) {
    if (v !== undefined) (updates as Record<string, unknown>)[k] = v;
  }

  try {
    const { data: plan, error } = await supabase
      .from("plans")
      .update(updates)
      .eq("id", parsedParams.data.id)
      .select()
      .maybeSingle();

    if (error) {
      console.error("payment-plans/[id] PATCH error", error);
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
    console.error("payment-plans/[id] PATCH error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
