import { notFound } from "next/navigation";
import { getCoachDashboardContext } from "../../_lib/getCoachDashboardContext";
import { getStudentLessonsByCourse } from "@/src/lib/lessons/server/getStudentLessonsByCourse";
import { createClient } from "@/src/services/supabase/server";
import LessonTasksClient from "./_components/LessonTasksClient";
import { fullName } from "@/src/utils/formatName";
import type { Metadata } from "next";

interface CoachStudentLessonsPageProps {
  params: Promise<{ studentId: string }>;
}

export async function generateMetadata({
  params,
}: CoachStudentLessonsPageProps): Promise<Metadata> {
  const { studentId } = await params;
  try {
    const { students } = await getCoachDashboardContext();
    const student = students.find((s) => s.id === studentId);
    if (!student) return { title: "Lessons" };
    return {
      title: `${fullName(student.first_name, student.last_name, "Student")} — Lessons`,
    };
  } catch {
    return { title: "Lessons" };
  }
}

export default async function CoachStudentLessonsPage({
  params,
}: CoachStudentLessonsPageProps) {
  const { studentId } = await params;
  const { students } = await getCoachDashboardContext();
  const student = students.find((s) => s.id === studentId);
  if (!student) notFound();

  const supabase = await createClient();
  const courses = await getStudentLessonsByCourse(supabase, student.id);

  // Reward-token icon/title per lesson (top-right of each card), from the same
  // `tokens` source the student/parent lesson grids use.
  const lessonIds = courses.flatMap((c) => c.lessons.map((l) => l.id));
  const tokensByLesson: Record<
    string,
    { icon: string | null; title: string | null }
  > = {};
  if (lessonIds.length > 0) {
    const { data: tokens } = await supabase
      .from("tokens")
      .select("lesson_id, icon_url, title")
      .in("lesson_id", lessonIds);
    for (const t of tokens ?? []) {
      if (t.lesson_id) {
        tokensByLesson[t.lesson_id] = { icon: t.icon_url, title: t.title };
      }
    }
  }

  return (
    <div className="min-h-0 flex-1">
      <LessonTasksClient
        studentId={student.id}
        courses={courses}
        activeCourseId={student.active_course_id}
        tokensByLesson={tokensByLesson}
      />
    </div>
  );
}
