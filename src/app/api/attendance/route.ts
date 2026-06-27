import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  requireRole,
  type AuthContext,
  type Role,
} from "@/src/lib/auth/server/requireRole";
import {
  assertOwnsStudent,
  assertCoachAssignedToStudent,
} from "@/src/lib/auth/server/ownership";
import { computeAttendanceStreak } from "@/src/utils/attendanceStreak";

const GetQuerySchema = z
  .object({ student_id: z.string().uuid() })
  .strict();

const PostBodySchema = z
  .object({
    student_id: z.string().uuid(),
    session_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    status: z.enum(["attended", "missed", "cancelled"]),
    session_id: z.number().int().optional(),
    notes: z.string().optional(),
  })
  .strict();

const DeleteBodySchema = z
  .object({
    student_id: z.string().uuid(),
    session_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    session_id: z.number().int().optional(),
  })
  .strict();

async function checkAttendanceOwnership(
  auth: AuthContext,
  studentId: string,
): Promise<NextResponse | null> {
  const role = auth.account.role as Role;
  if (role === 1) {
    const r = await assertOwnsStudent(auth, studentId);
    return r instanceof NextResponse ? r : null;
  }
  if (role === 2) {
    const r = await assertCoachAssignedToStudent(auth, studentId);
    return r instanceof NextResponse ? r : null;
  }
  return null; // role 3 admin: bypass
}

export async function GET(request: NextRequest) {
  const auth = await requireRole([]);
  if (auth instanceof NextResponse) return auth;
  const { supabase } = auth;

  const parsed = GetQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid request parameters",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const ownership = await checkAttendanceOwnership(
    auth,
    parsed.data.student_id,
  );
  if (ownership) return ownership;

  try {
    const { data: records, error } = await supabase
      .from("session_attendance")
      .select("id, session_date, session_id, status, notes, coach_id")
      .eq("student_id", parsed.data.student_id)
      .order("session_date", { ascending: false });

    if (error) {
      console.error("attendance GET query error", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }

    const streak = computeAttendanceStreak(records ?? []);

    return NextResponse.json({ attendance: records ?? [], streak });
  } catch (error: unknown) {
    console.error("attendance GET error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireRole([2, 3]);
  if (auth instanceof NextResponse) return auth;
  const { supabase, user } = auth;

  const parsed = PostBodySchema.safeParse(
    await request.json().catch(() => ({})),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { student_id, session_date, status, session_id, notes } = parsed.data;

  const ownership = await checkAttendanceOwnership(auth, student_id);
  if (ownership) return ownership;

  try {
    // Auto-lookup coach_id from authenticated user's coach profile
    const { data: coachProfile } = await supabase
      .from("coaches")
      .select("id")
      .eq("account_id", user.id)
      .maybeSingle();

    // Check existing record to detect status transition for sessions_remaining adjustment
    const { data: existing } = await supabase
      .from("session_attendance")
      .select("status")
      .eq("student_id", student_id)
      .eq("session_date", session_date)
      .maybeSingle();

    const { data, error } = await supabase
      .from("session_attendance")
      .upsert(
        {
          student_id,
          session_date,
          session_id: session_id ?? null,
          status,
          coach_id: coachProfile?.id ?? null,
          notes: notes ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "student_id,session_date" },
      )
      .select()
      .single();

    if (error) {
      console.error("attendance POST upsert error", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }

    // "attended" and "missed" both consume a session slot; "cancelled" does not.
    // Adjust sessions_remaining only when the consuming state changes.
    const wasConsuming =
      existing?.status === "attended" || existing?.status === "missed";
    const nowConsuming = status === "attended" || status === "missed";

    if (!wasConsuming && nowConsuming) {
      const { data: sub } = await supabase
        .from("student_subscriptions")
        .select("id, sessions_remaining")
        .eq("student_id", student_id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      if (sub && sub.sessions_remaining != null && sub.sessions_remaining > 0) {
        await supabase
          .from("student_subscriptions")
          .update({ sessions_remaining: sub.sessions_remaining - 1 })
          .eq("id", sub.id);
      }
    } else if (wasConsuming && !nowConsuming) {
      const { data: sub } = await supabase
        .from("student_subscriptions")
        .select("id, sessions_remaining")
        .eq("student_id", student_id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      if (sub) {
        await supabase
          .from("student_subscriptions")
          .update({ sessions_remaining: (sub.sessions_remaining ?? 0) + 1 })
          .eq("id", sub.id);
      }
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error: unknown) {
    console.error("attendance POST error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireRole([2, 3]);
  if (auth instanceof NextResponse) return auth;
  const { supabase } = auth;

  const parsed = DeleteBodySchema.safeParse(
    await request.json().catch(() => ({})),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { student_id, session_date, session_id } = parsed.data;

  const ownership = await checkAttendanceOwnership(auth, student_id);
  if (ownership) return ownership;

  try {
    const baseQuery = supabase
      .from("session_attendance")
      .select("id, status")
      .eq("student_id", student_id);
    const lookupQuery =
      session_id != null
        ? baseQuery.eq("session_id", session_id)
        : baseQuery.eq("session_date", session_date);

    const { data: existing, error: existingError } =
      await lookupQuery.maybeSingle();

    if (existingError) {
      console.error("attendance DELETE lookup error", existingError);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }
    if (!existing) return NextResponse.json({ success: true }, { status: 200 });

    const deleteQuery = supabase
      .from("session_attendance")
      .delete()
      .eq("id", existing.id);

    const { error } = await deleteQuery;
    if (error) {
      console.error("attendance DELETE error", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }

    const wasConsuming =
      existing.status === "attended" || existing.status === "missed";

    if (wasConsuming) {
      const { data: sub } = await supabase
        .from("student_subscriptions")
        .select("id, sessions_remaining")
        .eq("student_id", student_id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      if (sub) {
        await supabase
          .from("student_subscriptions")
          .update({ sessions_remaining: (sub.sessions_remaining ?? 0) + 1 })
          .eq("id", sub.id);
      }
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: unknown) {
    console.error("attendance DELETE error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
