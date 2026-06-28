import { notFound } from "next/navigation";
import AttendancePanel from "./_components/AttendancePanel";
import { getCoachDashboardContext } from "../../_lib/getCoachDashboardContext";
import { fullName } from "@/src/utils/formatName";
import type { Metadata } from "next";

interface AttendancePageProps {
  params: Promise<{ studentId: string }>;
}

export async function generateMetadata({
  params,
}: AttendancePageProps): Promise<Metadata> {
  const { studentId } = await params;
  try {
    const { students } = await getCoachDashboardContext();
    const student = students.find((s) => s.id === studentId);
    if (!student) return { title: "Attendance" };
    return {
      title: `${fullName(student.first_name, student.last_name, "Student")} - Attendance`,
    };
  } catch {
    return { title: "Attendance" };
  }
}

export default async function CoachStudentAttendancePage({
  params,
}: AttendancePageProps) {
  const { studentId } = await params;
  const { students } = await getCoachDashboardContext();
  const student = students.find((s) => s.id === studentId);
  if (!student) notFound();

  return (
    <AttendancePanel
      studentId={student.id}
      firstName={student.first_name}
      lastName={student.last_name}
    />
  );
}
