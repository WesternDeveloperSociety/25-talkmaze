import { notFound } from "next/navigation";
import { createClient } from "@/src/services/supabase/server";
import LessonDetailClient from "./LessonDetailClient";
import { getCoachDashboardContext } from "../../../_lib/getCoachDashboardContext";
import type { Metadata } from "next";

interface PageProps {
  params: Promise<{ studentId: string; lessonId: string }>;
}

async function resolveStorageUrl(supabase: any, path: string | null) {
  if (!path) return null;
  const cleanPath = path.replace(/^course_files\//, "");
  const { data } = supabase.storage
    .from("course_files")
    .getPublicUrl(cleanPath);
  return data?.publicUrl ?? null;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { studentId, lessonId } = await params;
  try {
    const { students } = await getCoachDashboardContext();
    if (!students.some((s) => s.id === studentId)) return { title: "Lesson" };
    const supabase = await createClient();
    const { data } = await supabase
      .from("lessons")
      .select("title")
      .eq("id", lessonId)
      .maybeSingle();
    return { title: data?.title ?? "Lesson" };
  } catch {
    return { title: "Lesson" };
  }
}

/**
 * CoachLessonDetailPage -
 * Server component for /coach/students/[studentId]/lessons/[lessonId]
 *
 * Fetches lesson info, student name, progress/feedback, and task rows from the DB,
 * then hands everything to LessonDetailClient for interactive editing.
 *
 * Calls notFound() (404) if either the lesson or student doesn't exist.
 */
export default async function CoachLessonDetailPage({ params }: PageProps) {
  const { studentId, lessonId } = await params;
  const supabase = await createClient();

  // Fetch lesson, student, progress/feedback, and lesson_tasks in parallel
  const [
    { data: lesson, error: lessonError },
    { data: student, error: studentError },
    { data: progress },
    { data: tasksData },
  ] = await Promise.all([
    (supabase.from("lessons") as any)
      .select(
        "id, title, description, course_id, slide_show_url, courses!lessons_course_id_fkey(title)",
      )
      .eq("id", lessonId)
      .single(),
    (supabase.from("students") as any)
      .select("id, first_name, last_name")
      .eq("id", studentId)
      .single(),
    (supabase.from("lesson_progress") as any)
      .select("status, positive_feedback, improvement_feedback")
      .eq("student_id", studentId)
      .eq("lesson_id", lessonId)
      .maybeSingle(),
    (supabase.from("lesson_tasks") as any)
      .select("id, type, file_url, description, student_id")
      .eq("lesson_id", lessonId)
      .or(`student_id.eq.${studentId},student_id.is.null`),
  ]);

  if (lessonError || !lesson) {
    console.error(
      "[CoachLessonDetail] lesson query failed:",
      lessonError,
      "lesson:",
      lesson,
      "lessonId:",
      lessonId,
    );
    notFound();
  }

  if (studentError || !student) {
    console.error(
      "[CoachLessonDetail] student query failed:",
      studentError,
      "student:",
      student,
      "studentId:",
      studentId,
    );
    notFound();
  }

  // Resolve effective task rows: student override takes priority over admin default
  const tasks: {
    id: string;
    type: string;
    file_url: string | null;
    description: string | null;
    student_id: string | null;
  }[] = tasksData ?? [];

  const defaultPreTask =
    tasks.find((t) => t.type === "pre" && t.student_id === null) ?? null;
  const defaultPostTask =
    tasks.find((t) => t.type === "post" && t.student_id === null) ?? null;
  const overridePreTask =
    tasks.find((t) => t.type === "pre" && t.student_id === studentId) ?? null;
  const overridePostTask =
    tasks.find((t) => t.type === "post" && t.student_id === studentId) ?? null;

  // Resolve storage URLs in parallel
  const [
    slideshowUrl,
    defaultPreUrl,
    defaultPostUrl,
    overridePreUrl,
    overridePostUrl,
  ] = await Promise.all([
    resolveStorageUrl(supabase, lesson.slide_show_url),
    resolveStorageUrl(supabase, defaultPreTask?.file_url ?? null),
    resolveStorageUrl(supabase, defaultPostTask?.file_url ?? null),
    resolveStorageUrl(supabase, overridePreTask?.file_url ?? null),
    resolveStorageUrl(supabase, overridePostTask?.file_url ?? null),
  ]);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-[#F4F7FA]">
      <LessonDetailClient
        studentId={studentId}
        lessonId={lessonId}
        courseId={lesson.course_id}
        studentName={
          [student.first_name, student.last_name].filter(Boolean).join(" ") ||
          "Student"
        }
        lesson={{
          title: lesson.title,
          description: lesson.description,
          courseName: lesson.courses?.title ?? null,
          slideshowUrl,
        }}
        initialStatus={progress?.status ?? 1}
        initialPositiveFeedback={progress?.positive_feedback ?? ""}
        initialImprovementFeedback={progress?.improvement_feedback ?? ""}
        defaultPreTask={
          defaultPreTask ? { ...defaultPreTask, file_url: defaultPreUrl } : null
        }
        defaultPostTask={
          defaultPostTask
            ? { ...defaultPostTask, file_url: defaultPostUrl }
            : null
        }
        overridePreTask={
          overridePreTask
            ? { ...overridePreTask, file_url: overridePreUrl }
            : null
        }
        overridePostTask={
          overridePostTask
            ? { ...overridePostTask, file_url: overridePostUrl }
            : null
        }
      />
    </div>
  );
}
