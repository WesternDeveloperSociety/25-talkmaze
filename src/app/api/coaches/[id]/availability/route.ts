import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/src/lib/auth/server/requireRole";

/**
 * Coach availability CRUD. TODO: the PUT delete-then-insert is not
 * transactional - a partial failure leaves the coach with zero availability.
 * Wrap in a Supabase RPC (server-side function with a single transaction) or
 * restructure to insert-then-flip-active. Tracked as data-integrity follow-up.
 */

const DAY_MAP: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

const ParamsSchema = z.object({ id: z.string().uuid() }).strict();

const PutBodySchema = z
  .object({
    availability: z.record(
      z.string(),
      z.array(z.object({ start: z.string(), end: z.string() })),
    ),
    timezone: z.string().min(1).optional(),
  })
  .strict();

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
      .from("coach_availabilities")
      .select(
        "weekday, start_time, end_time, start_time_new, end_time_new, timezone",
      )
      .eq("coach_id", parsed.data.id);

    if (error) {
      console.error("coaches/[id]/availability GET error", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }
    return NextResponse.json({ availability: data ?? [] });
  } catch (err: unknown) {
    console.error("coaches/[id]/availability GET error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PUT(
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
  const parsedBody = PutBodySchema.safeParse(
    await req.json().catch(() => ({})),
  );
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsedBody.error.flatten() },
      { status: 400 },
    );
  }

  const coachId = parsedParams.data.id;
  const { availability, timezone } = parsedBody.data;

  try {
    const { error: deleteError } = await supabase
      .from("coach_availabilities")
      .delete()
      .eq("coach_id", coachId);

    if (deleteError) {
      console.error("coaches/[id]/availability PUT delete error", deleteError);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }

    const rows = Object.entries(availability).flatMap(([day, slots]) =>
      slots
        .filter((s) => s.start && s.end)
        .map((s) => ({
          coach_id: coachId,
          weekday: DAY_MAP[day],
          start_time: new Date(`1970-01-01T${s.start}:00Z`).toISOString(),
          end_time: new Date(`1970-01-01T${s.end}:00Z`).toISOString(),
          start_time_new: `${s.start}:00`,
          end_time_new: `${s.end}:00`,
          timezone: timezone || "America/New_York",
        })),
    );

    if (rows.length > 0) {
      const { error: insertError } = await supabase
        .from("coach_availabilities")
        .insert(rows);
      if (insertError) {
        console.error(
          "coaches/[id]/availability PUT insert error",
          insertError,
        );
        return NextResponse.json(
          { error: "Internal server error" },
          { status: 500 },
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("coaches/[id]/availability PUT error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
