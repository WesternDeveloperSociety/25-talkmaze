import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/services/supabase/types/database";

type CoachCourseAssignment = {
  id: string;
  isActive: boolean;
  assigned_at: string;
  progress: number;
};

type CoachCourseRow = {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
  assignment: CoachCourseAssignment | null;
};

type ListCoursesForCoachResult =
  | { ok: true; courses: CoachCourseRow[] }
  | { ok: false; status: number; error: string };

/**
 * Coach leg of GET /api/courses: the course catalog, optionally decorated
 * with a linked student's assignment + live progress.
 *
 * When `student_id` is present, each course carries the student's current
 * assignment row (or null). When absent, every `assignment` is null so
 * callers can rely on the key existing. Ownership of `student_id`
 * (assertCoachAssignedToStudent) is enforced by the route before calling.
 *
 * Queries moved verbatim from the old coach-audience courses handler.
 */
export async function listCoursesForCoach(
  supabase: SupabaseClient<Database>,
  student_id?: string,
): Promise<ListCoursesForCoachResult> {
  // course_assignment.progress is a stale denormalized column — set to 0
  // on insert and never updated by anything in the codebase. Compute the
  // real progress from lesson_progress rows instead.
  const [coursesResult, assignmentsResult, lessonsResult, progressResult] =
    await Promise.all([
      supabase.from("courses").select("id, title, description, created_at"),
      student_id
        ? supabase
            .from("course_assignment")
            .select("id, course_id, isActive, created_at")
            .eq("student_id", student_id)
        : Promise.resolve({ data: null, error: null }),
      student_id
        ? supabase.from("lessons").select("id, course_id")
        : Promise.resolve({ data: null, error: null }),
      student_id
        ? supabase
            .from("lesson_progress")
            .select("lesson_id, status")
            .eq("student_id", student_id)
        : Promise.resolve({ data: null, error: null }),
    ]);

  if (coursesResult.error) {
    console.error("courses GET error", coursesResult.error);
    return { ok: false, status: 500, error: "Internal server error" };
  }
  if (assignmentsResult.error) {
    console.error("courses GET assignments error", assignmentsResult.error);
    return { ok: false, status: 500, error: "Internal server error" };
  }
  if (lessonsResult.error) {
    console.error("courses GET lessons error", lessonsResult.error);
    return { ok: false, status: 500, error: "Internal server error" };
  }
  if (progressResult.error) {
    console.error("courses GET progress error", progressResult.error);
    return { ok: false, status: 500, error: "Internal server error" };
  }

  const totalByCourse = new Map<string, number>();
  const completedLessonIds = new Set(
    (progressResult.data ?? [])
      .filter((p) => p.status === 3)
      .map((p) => p.lesson_id)
      .filter((id): id is string => !!id),
  );
  const completedByCourse = new Map<string, number>();
  for (const lesson of lessonsResult.data ?? []) {
    if (!lesson.course_id) continue;
    totalByCourse.set(
      lesson.course_id,
      (totalByCourse.get(lesson.course_id) ?? 0) + 1,
    );
    if (completedLessonIds.has(lesson.id)) {
      completedByCourse.set(
        lesson.course_id,
        (completedByCourse.get(lesson.course_id) ?? 0) + 1,
      );
    }
  }

  const assignmentsByCourseId = new Map<
    string,
    {
      id: string;
      isActive: boolean;
      assigned_at: string;
      progress: number;
    }
  >();
  for (const a of assignmentsResult.data ?? []) {
    if (!a.course_id) continue;
    const total = totalByCourse.get(a.course_id) ?? 0;
    const completed = completedByCourse.get(a.course_id) ?? 0;
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
    assignmentsByCourseId.set(a.course_id, {
      id: a.id,
      isActive: a.isActive ?? false,
      assigned_at: a.created_at,
      progress,
    });
  }

  const courses = (coursesResult.data ?? []).map((c) => ({
    ...c,
    assignment: assignmentsByCourseId.get(c.id) ?? null,
  }));

  return { ok: true, courses };
}
