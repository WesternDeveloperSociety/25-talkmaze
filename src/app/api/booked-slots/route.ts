import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/src/lib/auth/server/requireRole";

// Only pending slots are listable for now; widen the enum when other
// statuses gain a read use-case.
const QuerySchema = z
  .object({
    status: z.enum(["pending"]),
  })
  .strict();

export async function GET(req: Request) {
  const auth = await requireRole([3]);
  if (auth instanceof NextResponse) return auth;
  const { supabase } = auth;

  const parsedQuery = QuerySchema.safeParse(
    Object.fromEntries(new URL(req.url).searchParams),
  );
  if (!parsedQuery.success) {
    return NextResponse.json(
      {
        error: "Invalid request parameters",
        details: parsedQuery.error.flatten(),
      },
      { status: 400 },
    );
  }

  try {
    const { data, error } = await supabase
      .from("booked_slots")
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
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    if (error) {
      console.error("booked-slots GET error", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }

    return NextResponse.json({ booked_slots: data ?? [] });
  } catch (err: unknown) {
    console.error("booked-slots GET error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
