import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/src/lib/auth/server/requireRole";
import { assertOwnsStudent } from "@/src/lib/auth/server/ownership";
import { timeZoneSchema } from "@/src/lib/scheduling/schemas";

const DAY_MAP: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

const ParamsSchema = z.object({ studentId: z.string().uuid() }).strict();

const PutBodySchema = z
  .object({
    availability: z.record(
      z.string(),
      z.array(z.object({ start: z.string(), end: z.string() })),
    ),
    timezone: timeZoneSchema,
  })
  .strict();

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ studentId: string }> },
) {
  const auth = await requireRole([1]);
  if (auth instanceof NextResponse) return auth;
  const { supabase } = auth;

  const parsed = ParamsSchema.safeParse(await params);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request parameters", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const ownership = await assertOwnsStudent(auth, parsed.data.studentId);
  if (ownership instanceof NextResponse) return ownership;

  try {
    const { data, error } = await supabase
      .from("student_availabilities")
      .select("weekday, start_time, end_time, timezone")
      .eq("student_id", parsed.data.studentId);
    if (error) {
      console.error("students/[studentId]/availability GET error", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }
    return NextResponse.json({ availability: data ?? [] });
  } catch (err: unknown) {
    console.error("students/[studentId]/availability GET error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ studentId: string }> },
) {
  const auth = await requireRole([1]);
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

  const ownership = await assertOwnsStudent(auth, parsedParams.data.studentId);
  if (ownership instanceof NextResponse) return ownership;

  try {
    const { error: deleteError } = await supabase
      .from("student_availabilities")
      .delete()
      .eq("student_id", parsedParams.data.studentId);
    if (deleteError) {
      console.error("students/[studentId]/availability PUT delete error", deleteError);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }

    const rows = Object.entries(parsedBody.data.availability).flatMap(
      ([day, slots]) =>
        slots
          .filter((s) => s.start && s.end)
          .map((s) => ({
            student_id: parsedParams.data.studentId,
            weekday: DAY_MAP[day],
            start_time: new Date(`1970-01-01T${s.start}:00Z`).toISOString(),
            end_time: new Date(`1970-01-01T${s.end}:00Z`).toISOString(),
            start_time_new: `${s.start}:00`,
            end_time_new: `${s.end}:00`,
            timezone: parsedBody.data.timezone,
          })),
    );
    if (rows.length > 0) {
      const { error: insertError } = await supabase
        .from("student_availabilities")
        .insert(rows);
      if (insertError) {
        console.error("students/[studentId]/availability PUT insert error", insertError);
        return NextResponse.json(
          { error: "Internal server error" },
          { status: 500 },
        );
      }
    }
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("students/[studentId]/availability PUT error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
