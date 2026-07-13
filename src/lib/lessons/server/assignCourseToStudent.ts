import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/services/supabase/types/database";

type AssignInput = {
  studentId: string;
  courseId: string;
};

type AssignAction = "created" | "resurrected" | "noop";

type AssignResult =
  | { ok: true; action: AssignAction }
  | { ok: false; status: number; error: string };

/**
 * Assigns a course to a student. Idempotent.
 *
 * - If an active assignment already exists → `action: "noop"`.
 * - If a soft-deleted (isActive=false) assignment exists → flip it back to
 *   active and return `action: "resurrected"`. Lesson_progress rows are
 *   preserved from the prior assignment so the student resumes where they
 *   left off.
 * - Otherwise insert one lesson_progress row per lesson (status = 1 = "not
 *   started") plus a course_assignment row → `action: "created"`.
 *
 * Side effects in the "created" path are not transactional — same caveat as
 * insertLessonIntoCourse. Canonical fix is a Postgres RPC; tracked in
 * repo-quality-audit.md.
 *
 * Shared between the admin and coach legs of POST /api/courses/[courseId]/students.
 */
export async function assignCourseToStudent(
  supabase: SupabaseClient<Database>,
  input: AssignInput,
): Promise<AssignResult> {
  const { studentId, courseId } = input;

  const { data: existing, error: existingError } = await supabase
    .from("course_assignment")
    .select("id, isActive")
    .eq("student_id", studentId)
    .eq("course_id", courseId)
    .maybeSingle();

  if (existingError) {
    console.error(
      "assignCourseToStudent: lookup existing error",
      existingError,
    );
    return { ok: false, status: 500, error: "Internal server error" };
  }

  if (existing) {
    if (existing.isActive) {
      return { ok: true, action: "noop" };
    }
    const { error: resurrectError } = await supabase
      .from("course_assignment")
      .update({ isActive: true })
      .eq("id", existing.id);
    if (resurrectError) {
      console.error("assignCourseToStudent: resurrect error", resurrectError);
      return { ok: false, status: 500, error: "Internal server error" };
    }
    await ensureActiveCourseSet(supabase, studentId, courseId);
    return { ok: true, action: "resurrected" };
  }

  const { data: lessons, error: lessonsError } = await supabase
    .from("lessons")
    .select("id")
    .eq("course_id", courseId);

  if (lessonsError) {
    console.error("assignCourseToStudent: fetch lessons error", lessonsError);
    return { ok: false, status: 500, error: "Internal server error" };
  }

  const progressRows = (lessons ?? []).map((lesson) => ({
    student_id: studentId,
    status: 1,
    lesson_id: lesson.id,
  }));

  if (progressRows.length > 0) {
    const { error: pushError } = await supabase
      .from("lesson_progress")
      .insert(progressRows);

    if (pushError) {
      console.error("assignCourseToStudent: push lessons error", pushError);
      return { ok: false, status: 500, error: "Internal server error" };
    }
  }

  const { error: assignError } = await supabase
    .from("course_assignment")
    .insert({
      course_id: courseId,
      student_id: studentId,
      progress: 0,
      isActive: true,
    });

  if (assignError) {
    console.error(
      "assignCourseToStudent: insert assignment error",
      assignError,
    );
    return { ok: false, status: 500, error: "Internal server error" };
  }

  await ensureActiveCourseSet(supabase, studentId, courseId);
  return { ok: true, action: "created" };
}

/**
 * If the student doesn't yet have an active_course_id, point it at the
 * newly-assigned course. Doesn't override an existing selection — only fills
 * in the initial value. Failure is logged but not propagated; the assignment
 * has already succeeded.
 */
async function ensureActiveCourseSet(
  supabase: SupabaseClient<Database>,
  studentId: string,
  courseId: string,
) {
  const { data: student, error: lookupError } = await supabase
    .from("students")
    .select("active_course_id")
    .eq("id", studentId)
    .maybeSingle();
  if (lookupError) {
    console.error("ensureActiveCourseSet: lookup error", lookupError);
    return;
  }
  if (student?.active_course_id) return;

  const { error: updateError } = await supabase
    .from("students")
    .update({ active_course_id: courseId })
    .eq("id", studentId);
  if (updateError) {
    console.error("ensureActiveCourseSet: update error", updateError);
  }
}
