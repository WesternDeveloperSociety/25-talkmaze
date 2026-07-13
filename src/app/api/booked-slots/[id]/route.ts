import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/src/lib/auth/server/requireRole";

const ParamsSchema = z.object({ id: z.string().uuid() }).strict();

const BodySchema = z
  .object({
    coach_id: z.string().uuid(),
    weekday: z.number().int().min(0).max(6),
    start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
    end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
    timezone: z.string().min(1),
    num_sessions: z.number().int().positive(),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .strict();

function normalizeTime(value: string) {
  return /^\d{2}:\d{2}$/.test(value) ? `${value}:00` : value;
}

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

  const parsedBody = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsedBody.error.flatten() },
      { status: 400 },
    );
  }
  const data = parsedBody.data;
  const startTime = normalizeTime(data.start_time);
  const endTime = normalizeTime(data.end_time);

  if (startTime >= endTime) {
    return NextResponse.json(
      { error: "Start time must be before end time" },
      { status: 400 },
    );
  }

  const startDateWeekday = new Date(`${data.start_date}T12:00:00Z`).getUTCDay();
  if (startDateWeekday !== data.weekday) {
    return NextResponse.json(
      { error: "Start date must match the selected weekday" },
      { status: 400 },
    );
  }

  try {
    const { data: coach } = await supabase
      .from("coaches")
      .select("id")
      .eq("id", data.coach_id)
      .maybeSingle();

    if (!coach) {
      return NextResponse.json(
        { error: "Selected coach was not found" },
        { status: 404 },
      );
    }

    const { data: updated, error } = await supabase
      .from("booked_slots")
      .update({
        coach_id: data.coach_id,
        weekday: data.weekday,
        start_date: data.start_date,
        start_time: startTime,
        end_time: endTime,
        timezone: data.timezone,
        num_sessions: data.num_sessions,
      })
      .eq("id", parsedParams.data.id)
      .eq("status", "pending")
      .select(
        `
        id,
        coach_id,
        student_id,
        weekday,
        start_time,
        start_date,
        end_time,
        timezone,
        status,
        num_sessions,
        created_at,
        coaches(first_name, last_name),
        students(first_name, last_name, account_id)
      `,
      )
      .single();

    if (error) {
      console.error("booked-slots PATCH error", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }

    return NextResponse.json({ booked_slot: updated });
  } catch (err: unknown) {
    console.error("booked-slots PATCH error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
