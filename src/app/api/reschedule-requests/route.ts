import { NextResponse } from "next/server";
import { requireRole } from "@/src/lib/auth/server/requireRole";

export async function GET() {
  const auth = await requireRole([2]);
  if (auth instanceof NextResponse) return auth;
  const { supabase, user } = auth;

  try {
    const { data: coach, error: coachError } = await supabase
      .from("coaches")
      .select("id")
      .eq("account_id", user.id)
      .maybeSingle();
    if (coachError) {
      console.error("reschedule-requests coach lookup error", coachError);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }
    if (!coach) {
      console.error("reschedule-requests: role=2 but no coaches row", {
        userId: user.id,
      });
      return NextResponse.json(
        { error: "Coach record missing" },
        { status: 500 },
      );
    }

    const { data: requests, error: listError } = await supabase
      .from("sessions")
      .select(
        `id, start_time, end_time, requested_start_time, requested_end_time,
         requested_at, student_id,
         students(first_name, last_name)`,
      )
      .eq("coach_id", coach.id)
      .eq("reschedule_status", "pending")
      .order("requested_at", { ascending: true });
    if (listError) {
      console.error("reschedule-requests list error", listError);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }

    return NextResponse.json({ requests: requests ?? [] });
  } catch (err: unknown) {
    console.error("reschedule-requests error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
