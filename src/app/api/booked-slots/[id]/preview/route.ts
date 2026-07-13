import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/src/lib/auth/server/requireRole";
import { previewPendingBooking } from "@/src/lib/scheduling/server/previewPendingBooking";

const ParamsSchema = z.object({ id: z.string().uuid() }).strict();

const BodySchema = z
  .object({
    coach_id: z.string().uuid(),
    weekday: z.number().int().min(0).max(6),
    start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
    end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
    timezone: z.string().min(1),
    num_sessions: z.number().int().positive(),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  })
  .strict();

export async function POST(
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
  const parsedBody = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsedBody.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const result = await previewPendingBooking(supabase, {
      bookingId: parsedParams.data.id,
      coachId: parsedBody.data.coach_id,
      weekday: parsedBody.data.weekday,
      startTime: parsedBody.data.start_time,
      endTime: parsedBody.data.end_time,
      timezone: parsedBody.data.timezone,
      numSessions: parsedBody.data.num_sessions,
      startDate: parsedBody.data.start_date,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }

    // Spread the result fields directly to preserve the existing response shape.
    const { ok: _ok, ...payload } = result;
    return NextResponse.json(payload);
  } catch (err: unknown) {
    console.error("booked-slots preview error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
