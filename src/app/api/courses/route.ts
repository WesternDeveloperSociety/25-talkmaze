import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/src/lib/auth/server/requireRole";
import { assertCoachAssignedToStudent } from "@/src/lib/auth/server/ownership";
import { listCoursesForAdmin } from "@/src/lib/lessons/server/listCoursesForAdmin";
import { listCoursesForCoach } from "@/src/lib/lessons/server/listCoursesForCoach";

const QuerySchema = z
  .object({
    student_id: z.string().uuid().optional(),
  })
  .strict();

const PostBodySchema = z
  .object({
    course: z
      .object({
        title: z.string().min(1),
        description: z.string().optional(),
      })
      .strict(),
  })
  .strict();

/**
 * Lists the course catalog. Role-dispatched:
 *
 * - Admin (3): raw catalog rows; query params are ignored (as before the
 *   audience-route merge).
 * - Coach (2): catalog for browsing when assigning a course to a student.
 *   When `student_id` is present, gates with the coach-student ownership
 *   check and decorates each course with the student's current assignment
 *   row (or null). When absent, every `assignment` is null so callers can
 *   rely on the key existing.
 */
export async function GET(req: Request) {
  // Stage 1: AUTH
  const auth = await requireRole([2, 3]);
  if (auth instanceof NextResponse) return auth;
  const { account, supabase } = auth;

  try {
    switch (account.role) {
      case 3: {
        // Stage 4: EXECUTE (admin leg — no query, no ownership)
        const result = await listCoursesForAdmin(supabase);
        if (!result.ok) {
          return NextResponse.json(
            { error: result.error },
            { status: result.status },
          );
        }
        return NextResponse.json({ courses: result.courses });
      }
      default: {
        // Stage 2: VALIDATE (coach leg only)
        const parsed = QuerySchema.safeParse(
          Object.fromEntries(new URL(req.url).searchParams),
        );
        if (!parsed.success) {
          return NextResponse.json(
            {
              error: "Invalid query parameters",
              details: parsed.error.flatten(),
            },
            { status: 400 },
          );
        }
        const { student_id } = parsed.data;

        // Stage 3: AUTHORIZE
        if (student_id) {
          const ownership = await assertCoachAssignedToStudent(
            auth,
            student_id,
          );
          if (ownership instanceof NextResponse) return ownership;
        }

        // Stage 4: EXECUTE
        const result = await listCoursesForCoach(supabase, student_id);
        if (!result.ok) {
          return NextResponse.json(
            { error: result.error },
            { status: result.status },
          );
        }
        return NextResponse.json({ courses: result.courses });
      }
    }
  } catch (err) {
    console.error("courses GET error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
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

  try {
    const { data, error } = await supabase
      .from("courses")
      .insert({
        title: parsed.data.course.title,
        description: parsed.data.course.description ?? null,
      })
      .select("id, title, description, created_at")
      .single();

    if (error) {
      console.error("courses POST insert error", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }

    return NextResponse.json({ course: data }, { status: 201 });
  } catch (err: unknown) {
    console.error("courses POST error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
