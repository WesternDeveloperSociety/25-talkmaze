import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/src/lib/auth/server/requireRole";

const ParamsSchema = z.object({ id: z.string().uuid() }).strict();

const PatchBodySchema = z
  .object({
    employee: z
      .object({
        first_name: z.string().nullable().optional(),
        last_name: z.string().nullable().optional(),
        avatar_url: z.string().nullable().optional(),
      })
      .strict(),
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
      {
        error: "Invalid request parameters",
        details: parsedParams.error.flatten(),
      },
      { status: 400 },
    );
  }
  const parsedBody = PatchBodySchema.safeParse(
    await req.json().catch(() => ({})),
  );
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsedBody.error.flatten() },
      { status: 400 },
    );
  }

  const payload: {
    first_name?: string | null;
    last_name?: string | null;
    avatar_url?: string | null;
  } = {};
  const { employee } = parsedBody.data;
  if (employee.first_name !== undefined)
    payload.first_name = employee.first_name || null;
  if (employee.last_name !== undefined)
    payload.last_name = employee.last_name || null;
  if (employee.avatar_url !== undefined)
    payload.avatar_url = employee.avatar_url;

  try {
    if (Object.keys(payload).length === 0) {
      return NextResponse.json({ success: true });
    }
    const { data, error } = await supabase
      .from("coaches")
      .update(payload)
      .eq("id", parsedParams.data.id)
      .select("id, account_id, first_name, last_name, avatar_url, created_at")
      .single();

    if (error) {
      console.error("coaches/[id] PATCH error", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }
    return NextResponse.json({ employee: data });
  } catch (err: unknown) {
    console.error("coaches/[id] PATCH error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
