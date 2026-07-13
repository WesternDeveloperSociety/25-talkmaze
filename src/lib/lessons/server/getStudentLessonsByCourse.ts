import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/services/supabase/types/database";

type Lesson = Database["public"]["Tables"]["lessons"]["Row"];
type LessonTask = Database["public"]["Tables"]["lesson_tasks"]["Row"];

export type CourseLessonsForStudent = {
  course_id: string;
  course_name: string;
  lessons: Lesson[];
  status: number[];
  pre_lesson_urls: (string | null)[];
  post_lesson_urls: (string | null)[];
  slide_show_inputs: (string | null)[];
};

/**
 * Assemble a student's lessons grouped by course, ordered by each course's
 * linked-list (head_lesson_id → next_lesson chain). Falls back to created_at
 * order when the linked list is broken. Resolves storage URLs (slide_show,
 * pre_task file, post_task file) per lesson using the student's override
 * → admin default priority.
 *
 * N+1 caveat: storage URL resolution still happens in a per-lesson loop.
 * Acceptable for admin UI where the lesson count per course is small.
 *
 * Extracted from the students lessons route (now GET
 * /api/students/[studentId]/lessons) per api-contract.md
 * §domain-logic-placement.
 */
export async function getStudentLessonsByCourse(
  supabase: SupabaseClient<Database>,
  studentId: string,
): Promise<CourseLessonsForStudent[]> {
  const { data: assignedCourses, error: assignedCoursesError } = await supabase
    .from("course_assignment")
    .select("course_id")
    .eq("student_id", studentId);

  if (assignedCoursesError) {
    throw new Error(
      `getStudentLessonsByCourse: assigned courses fetch — ${assignedCoursesError.message}`,
    );
  }

  const response: CourseLessonsForStudent[] = [];

  for (const { course_id } of assignedCourses ?? []) {
    if (!course_id) continue;

    const { data: courseHeadData } = await supabase
      .from("courses")
      .select("head_lesson_id, title")
      .eq("id", course_id)
      .single();

    const { data: allLessonsData, error: allLessonsError } = await supabase
      .from("lessons")
      .select("*")
      .eq("course_id", course_id);
    if (allLessonsError) {
      throw new Error(
        `getStudentLessonsByCourse: lessons fetch — ${allLessonsError.message}`,
      );
    }

    const { data: statusData, error: statusError } = await supabase
      .from("lesson_progress")
      .select("*")
      .eq("student_id", studentId);
    if (statusError) {
      throw new Error(
        `getStudentLessonsByCourse: progress fetch — ${statusError.message}`,
      );
    }

    // Fetch all lesson_tasks for this student + admin defaults.
    const lessonIds = (allLessonsData ?? []).map((l) => l.id);
    const tasksByLesson = new Map<string, LessonTask[]>();
    if (lessonIds.length > 0) {
      const { data: tasksData } = await supabase
        .from("lesson_tasks")
        .select("*")
        .in("lesson_id", lessonIds)
        .or(`student_id.eq.${studentId},student_id.is.null`);

      for (const task of tasksData ?? []) {
        const existing = tasksByLesson.get(task.lesson_id) ?? [];
        existing.push(task);
        tasksByLesson.set(task.lesson_id, existing);
      }
    }

    const courseEntry: CourseLessonsForStudent = {
      course_id,
      course_name: courseHeadData?.title ?? "",
      lessons: [],
      status: [],
      pre_lesson_urls: [],
      post_lesson_urls: [],
      slide_show_inputs: [],
    };

    const headLesson = (allLessonsData ?? []).find(
      (lesson) => lesson.id === courseHeadData?.head_lesson_id,
    );

    const orderedLessons = headLesson
      ? null
      : [...(allLessonsData ?? [])].sort(
          (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
        );

    let currentLesson = headLesson ?? orderedLessons?.shift();
    const remainingFallback = orderedLessons;

    while (currentLesson) {
      const status = (statusData ?? []).find(
        (statusObj) => statusObj.lesson_id === currentLesson?.id,
      )?.status;

      courseEntry.lessons.push(currentLesson);
      courseEntry.status.push(status ?? 1);

      // Slide show URL.
      courseEntry.slide_show_inputs.push(
        currentLesson.slide_show_url
          ? await getFileFromCloud(supabase, currentLesson.slide_show_url)
          : null,
      );

      // Pre/post task URLs (student override → admin default priority).
      const lessonTasks = tasksByLesson.get(currentLesson.id) ?? [];
      const effectivePre =
        lessonTasks.find((t) => t.type === "pre" && t.student_id === studentId) ??
        lessonTasks.find((t) => t.type === "pre" && t.student_id === null);
      const effectivePost =
        lessonTasks.find((t) => t.type === "post" && t.student_id === studentId) ??
        lessonTasks.find((t) => t.type === "post" && t.student_id === null);

      courseEntry.pre_lesson_urls.push(
        effectivePre?.file_url
          ? await getFileFromCloud(supabase, effectivePre.file_url)
          : null,
      );
      courseEntry.post_lesson_urls.push(
        effectivePost?.file_url
          ? await getFileFromCloud(supabase, effectivePost.file_url)
          : null,
      );

      const nextLessonId = currentLesson.next_lesson;
      if (nextLessonId) {
        currentLesson = (allLessonsData ?? []).find(
          (lesson) => lesson.id === nextLessonId,
        );
      } else {
        currentLesson = remainingFallback?.shift() ?? undefined;
      }
    }

    response.push(courseEntry);
  }

  return response;
}

async function getFileFromCloud(
  supabase: SupabaseClient<Database>,
  databaseUrl: string,
): Promise<string> {
  const cleanPath = databaseUrl.replace(/^course_files\//, "");
  const { data } = supabase.storage.from("course_files").getPublicUrl(cleanPath);
  return data.publicUrl;
}
