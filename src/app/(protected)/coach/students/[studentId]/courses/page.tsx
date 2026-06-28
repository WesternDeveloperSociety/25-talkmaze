import { notFound } from "next/navigation";
import CoursesPanel from "./_components/CoursesPanel";
import { getCoachDashboardContext } from "../../_lib/getCoachDashboardContext";
import { fullName } from "@/src/utils/formatName";
import type { Metadata } from "next";

interface CoursesPageProps {
  params: Promise<{ studentId: string }>;
}

export async function generateMetadata({
  params,
}: CoursesPageProps): Promise<Metadata> {
  const { studentId } = await params;
  try {
    const { students } = await getCoachDashboardContext();
    const student = students.find((s) => s.id === studentId);
    if (!student) return { title: "Courses" };
    return {
      title: `${fullName(student.first_name, student.last_name, "Student")} - Courses`,
    };
  } catch {
    return { title: "Courses" };
  }
}

export default async function CoachStudentCoursesPage({
  params,
}: CoursesPageProps) {
  const { studentId } = await params;
  const { students } = await getCoachDashboardContext();
  const student = students.find((s) => s.id === studentId);
  if (!student) notFound();

  return <CoursesPanel student={student} />;
}
