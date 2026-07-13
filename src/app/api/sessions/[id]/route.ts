import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/src/lib/auth/server/requireRole";
import { assertCoachOwnsSession } from "@/src/lib/auth/server/ownership";

const ParamsSchema = z
  .object({ id: z.coerce.number().int().positive() })
  .strict();

const BodySchema = z
  .object({
    start_time: z.string().datetime(),
    end_time: z.string().datetime(),
  })
  .strict();

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // Stage 1: AUTH
  const auth = await requireRole([2]);
  if (auth instanceof NextResponse) return auth;
  const { supabase } = auth;

  // Stage 2: VALIDATE — path param first (so "not-a-number" doesn't reach
  // assertCoachOwnsSession with NaN), then body.
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

  const parsedBody = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsedBody.success) {
    return NextResponse.json(
      {
        error: "Invalid request body",
        details: parsedBody.error.flatten(),
      },
      { status: 400 },
    );
  }

  // Stage 3: AUTHORIZE — 404 for both "missing" and "not yours" (enumeration
  // prevention; sessions.id is sequential bigint).
  const ownership = await assertCoachOwnsSession(auth, parsedParams.data.id);
  if (ownership instanceof NextResponse) return ownership;

  // Stage 4: EXECUTE
  try {
    // Also null any pending parent reschedule request — coach's unilateral
    // edit wins anbd the previous request becomes meaningless.
    const { error } = await supabase
      .from("sessions")
      .update({
        start_time: parsedBody.data.start_time,
        end_time: parsedBody.data.end_time,
        requested_start_time: null,
        requested_end_time: null,
        reschedule_status: null,
        requested_at: null,
      })
      .eq("id", parsedParams.data.id);
    if (error) {
      console.error("sessions/[id] update error", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("sessions/[id] error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
