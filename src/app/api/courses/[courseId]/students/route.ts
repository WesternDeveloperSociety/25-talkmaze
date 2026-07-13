import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/src/lib/auth/server/requireRole";
import { assertCoachAssignedToStudent } from "@/src/lib/auth/server/ownership";
import { assignCourseToStudent } from "@/src/lib/lessons/server/assignCourseToStudent";

const ParamsSchema = z.object({ courseId: z.string().uuid() }).strict();

const PostBodySchema = z
  .object({
    studentId: z.string().uuid(),
  })
  .strict();

// GET returns the *complement* of enrollment (the assignable-candidates
// picker). `assigned=false` is the only implemented mode; an enrolled-student
// list (`assigned=true`) does not exist yet, so the literal keeps the query
// honest instead of silently returning the wrong population.
const GetQuerySchema = z
  .object({
    assigned: z.literal("false"),
  })
  .strict();

/**
 * Enrolls a student in a course.
 *
 * Auth: coach role (2) with coach_students ownership of the student, or
 * admin role (3) with no ownership check. Both legs delegate to
 * src/lib/lessons/server/assignCourseToStudent.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> },
) {
  // Stage 1: AUTH
  const auth = await requireRole([2, 3]);
  if (auth instanceof NextResponse) return auth;
  const { account, supabase } = auth;

  // Stage 2: VALIDATE
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
  const parsedBody = PostBodySchema.safeParse(
    await req.json().catch(() => ({})),
  );
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsedBody.error.flatten() },
      { status: 400 },
    );
  }
  const { courseId } = parsedParams.data;
  const { studentId } = parsedBody.data;

  // Stage 3: AUTHORIZE — coaches must be linked to the student; admins bypass.
  if (account.role === 2) {
    const ownership = await assertCoachAssignedToStudent(auth, studentId);
    if (ownership instanceof NextResponse) return ownership;
  }

  // Stage 4: EXECUTE
  try {
    const result = await assignCourseToStudent(supabase, {
      studentId,
      courseId,
    });
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("courses/[courseId]/students POST error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * Lists students NOT assigned to the course (`?assigned=false` — required).
 * This is the assignable-candidates picker, not an enrollment list.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> },
) {
  // Stage 1: AUTH
  const auth = await requireRole([3]);
  if (auth instanceof NextResponse) return auth;
  const { supabase } = auth;

  // Stage 2: VALIDATE
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
  const parsedQuery = GetQuerySchema.safeParse(
    Object.fromEntries(new URL(req.url).searchParams),
  );
  if (!parsedQuery.success) {
    return NextResponse.json(
      {
        error:
          "Invalid query parameters: only assigned=false (students not assigned to the course) is supported",
        details: parsedQuery.error.flatten(),
      },
      { status: 400 },
    );
  }
  const { courseId } = parsedParams.data;

  // Stage 4: EXECUTE — only consider active assignments when filtering
  // out already-assigned students, so soft-deleted assignments correctly
  // reappear in the assignable list.
  const { data: assigned, error: assignedError } = await supabase
    .from("course_assignment")
    .select("student_id")
    .eq("course_id", courseId)
    .eq("isActive", true);

  if (assignedError) {
    console.error(
      "courses/[courseId]/students GET: fetch assigned error",
      assignedError,
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }

  const assignedIds = new Set((assigned ?? []).map((a) => a.student_id));

  const { data: students, error: studentsError } = await supabase
    .from("students")
    .select("*");

  if (studentsError) {
    console.error(
      "courses/[courseId]/students GET: fetch students error",
      studentsError,
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }

  const filtered = (students ?? []).filter((s) => !assignedIds.has(s.id));

  return NextResponse.json({ students: filtered });
}
