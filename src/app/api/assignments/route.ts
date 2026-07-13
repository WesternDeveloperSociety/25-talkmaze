import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/src/lib/auth/server/requireRole";
import type { Assignment } from "@/src/app/(protected)/admin/_types";

type AssignmentRow = {
  coach_id: string | null;
  student_id: string | null;
  coaches: {
    first_name: string | null;
    last_name: string | null;
  } | null;
  students: {
    first_name: string | null;
    last_name: string | null;
    account_id: string | null;
  } | null;
};

const PostBodySchema = z
  .object({
    coach_id: z.string().uuid(),
    student_id: z.string().uuid(),
  })
  .strict();

/**
 * Lists coach-student assignments with basic coach/student display fields.
 */
export async function GET() {
  const auth = await requireRole([3]);
  if (auth instanceof NextResponse) return auth;
  const { supabase } = auth;
  const { data, error } = await supabase.from("coach_students").select(`
      coach_id,
      student_id,
      coaches(first_name, last_name),
      students(first_name, last_name, account_id)
    `);

  if (error) {
    console.error("assignments GET error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }

  const assignments = (data as AssignmentRow[]).map((row) => ({
    id: `${row.coach_id}_${row.student_id}`,
    coach_id: String(row.coach_id),
    student_id: String(row.student_id),
    coaches: {
      first_name: row.coaches?.first_name ?? null,
      last_name: row.coaches?.last_name ?? null,
    },
    students: {
      first_name: row.students?.first_name ?? null,
      last_name: row.students?.last_name ?? null,
      account_id: row.students?.account_id ?? null,
    },
  }));

  return NextResponse.json({ assignments });
}

export async function POST(req: Request) {
  const auth = await requireRole([3]);
  if (auth instanceof NextResponse) return auth;
  const { supabase } = auth;

  const parsed = PostBodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { coach_id, student_id } = parsed.data;

  try {
    const { data: coachData } = await supabase
      .from("coaches")
      .select("id, first_name, last_name")
      .eq("id", coach_id)
      .maybeSingle();
    const { data: studentData } = await supabase
      .from("students")
      .select("id, first_name, last_name, account_id")
      .eq("id", student_id)
      .maybeSingle();

    if (!coachData) {
      return NextResponse.json({ error: "Coach not found" }, { status: 404 });
    }
    if (!studentData) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    const { error } = await supabase
      .from("coach_students")
      .insert({ coach_id: coachData.id, student_id: studentData.id });

    if (error) {
      console.error("assignments POST insert error", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }

    const newAssignment: Assignment = {
      id: `${coachData.id}_${studentData.id}`,
      coach_id: coachData.id,
      student_id: studentData.id,
      coaches: {
        first_name: coachData.first_name ?? null,
        last_name: coachData.last_name ?? null,
      },
      students: {
        first_name: studentData.first_name ?? null,
        last_name: studentData.last_name ?? null,
        account_id: studentData.account_id ?? null,
      },
    };
    return NextResponse.json({ assignment: newAssignment });
  } catch (err: unknown) {
    console.error("assignments POST error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
