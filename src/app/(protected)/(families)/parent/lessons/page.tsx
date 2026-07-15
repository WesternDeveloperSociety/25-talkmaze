import { redirect } from "next/navigation";
import { createClient } from "@/src/services/supabase/server";
import { getCurrentUser } from "@/src/lib/auth/server/getCurrentUser";
import StudentProgressCard from "./_components/StudentProgressCard";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Lessons" };

export default async function ParentLessons() {
  const supabase = await createClient();

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Fetch all students for this account
  const { data: studentsRaw } = await supabase
    .from("students")
    .select(
      "id, first_name, last_name, avatar_url, is_setup_complete, active_course_id",
    )
    .eq("account_id", user.id);

  const students = studentsRaw ?? [];

  if (students.length === 0) {
    return (
      <div className="w-full max-w-[1200px] mx-auto p-8 text-white">
        <h1 className="text-2xl font-bold mb-2">Lessons</h1>
        <p style={{ color: "#B1E7D6", opacity: 0.8 }}>
          No students found on this account.
        </p>
      </div>
    );
  }

  const studentIds = students.map((s) => s.id);

  // Fetch active course assignments for all students
  const { data: assignmentsRaw } = await supabase
    .from("course_assignment")
    .select("student_id, course_id, courses(id, title)")
    .in("student_id", studentIds)
    .eq("isActive", true);

  const assignments = assignmentsRaw ?? [];

  // Collect all unique course IDs
  const courseIds = [
    ...new Set(assignments.map((a) => a.course_id as string).filter(Boolean)),
  ];

  // Fetch all lesson IDs for those courses
  let allLessons: { id: string; course_id: string }[] = [];
  if (courseIds.length > 0) {
    const { data: lessonsRaw } = await supabase
      .from("lessons")
      .select("id, course_id")
      .in("course_id", courseIds);
    allLessons = lessonsRaw ?? [];
  }

  const allLessonIds = allLessons.map((l) => l.id);

  // Fetch tokens, earned tokens, and progress in parallel
  const [tokensResult, earnedResult, progressResult] = await Promise.all([
    allLessonIds.length > 0
      ? supabase
          .from("tokens")
          .select("id, title, icon_url, lesson_id")
          .in("lesson_id", allLessonIds)
      : Promise.resolve({ data: [] as any[] }),
    supabase
      .from("student_tokens")
      .select("student_id, token_id")
      .in("student_id", studentIds),
    supabase
      .from("lesson_progress")
      .select("student_id, lesson_id, status")
      .in("student_id", studentIds),
  ]);

  const allTokens = (tokensResult.data ?? []) as {
    id: string;
    title: string;
    icon_url: string | null;
    lesson_id: string | null;
  }[];
  const allEarned = (earnedResult.data ?? []) as {
    student_id: string;
    token_id: string;
  }[];
  const allProgress = (progressResult.data ?? []) as {
    student_id: string;
    lesson_id: string;
    status: number;
  }[];

  // Assemble per-student data
  const studentCards = students.map((student) => {
    // Prefer the student's active_course_id when present, otherwise fall
    // back to the first active assignment.
    const studentAssignments = assignments.filter(
      (a) => a.student_id === student.id,
    );
    const assignment =
      studentAssignments.find(
        (a) => a.course_id === student.active_course_id,
      ) ?? studentAssignments[0];
    const courseId = assignment?.course_id ?? null;
    const courseInfo = assignment?.courses as any;
    const courseName = courseInfo?.title ?? null;

    // Lessons for this student's course
    const courseLessonIds = new Set(
      courseId
        ? allLessons.filter((l) => l.course_id === courseId).map((l) => l.id)
        : [],
    );
    const totalLessons = courseLessonIds.size;

    // Completed lesson count (status === 3)
    const completedLessons = allProgress.filter(
      (p) =>
        p.student_id === student.id &&
        p.status === 3 &&
        courseLessonIds.has(p.lesson_id),
    ).length;

    // Tokens for this course (preserving lesson order isn't critical for the card)
    const courseTokens = allTokens.filter(
      (t) => t.lesson_id && courseLessonIds.has(t.lesson_id),
    );

    // Earned token IDs for this student
    const earnedTokenIds = allEarned
      .filter((e) => e.student_id === student.id)
      .map((e) => e.token_id);

    return {
      id: student.id,
      name:
        `${student.first_name ?? ""} ${student.last_name ?? ""}`.trim() ||
        "Student",
      avatarUrl: student.avatar_url,
      isSetupComplete: (student as any).is_setup_complete as boolean | null,
      courseName,
      completedLessons,
      totalLessons,
      courseTokens,
      earnedTokenIds,
    };
  });

  return (
    <div className="w-full max-w-[1200px] mx-auto p-4 sm:p-8">
      <h1 className="text-white text-2xl font-bold mb-6">Lessons</h1>
      <div className="grid gap-6 grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(320px,1fr))]">
        {studentCards.map((card) => (
          <StudentProgressCard
            key={card.id}
            studentId={card.id}
            name={card.name}
            avatarUrl={card.avatarUrl}
            isSetupComplete={card.isSetupComplete}
            courseName={card.courseName}
            completedLessons={card.completedLessons}
            totalLessons={card.totalLessons}
            courseTokens={card.courseTokens}
            earnedTokenIds={card.earnedTokenIds}
          />
        ))}
      </div>
    </div>
  );
}
