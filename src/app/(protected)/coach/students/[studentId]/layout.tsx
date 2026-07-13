import { ReactNode } from "react";
import { notFound } from "next/navigation";
import StudentHeaderBanner from "./_components/StudentHeaderBanner";
import StudentTabStrip from "./_components/StudentTabStrip";
import { getCoachDashboardContext } from "../_lib/getCoachDashboardContext";

interface CoachStudentLayoutProps {
  children: ReactNode;
  params: Promise<{ studentId: string }>;
}

/**
 * Per-student chrome (the right panel of the students split layout): the 
 * header banner + the tab strip, with the active tab's content as {children}.
 */
export default async function CoachStudentLayout({
  children,
  params,
}: CoachStudentLayoutProps) {
  const { studentId } = await params;
  const { students } = await getCoachDashboardContext();

  const selectedStudent = students.find((s) => s.id === studentId);
  if (!selectedStudent) notFound();

  return (
    <div className="flex flex-1 flex-col gap-4 xl:min-h-0">
      <StudentHeaderBanner student={selectedStudent} />
      <StudentTabStrip studentId={selectedStudent.id} />
      <div className="flex flex-1 flex-col xl:min-h-0 xl:overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
