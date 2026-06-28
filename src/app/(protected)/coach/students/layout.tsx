import { ReactNode } from "react";
import MyStudents from "./_components/MyStudents";
import { getCoachDashboardContext } from "./_lib/getCoachDashboardContext";

/**
 * Split-screen shell for the students area.
 *
 * The persistent "My Students" list on the left, and the selected student's
 * detail (or the empty state) as {children} on the right. Selection is
 * URL-driven, so this layout never owns it and never redirects.
 */
export default async function CoachStudentsLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { students } = await getCoachDashboardContext();

  return (
    <div className="flex flex-col p-4 xl:h-full xl:flex-row xl:overflow-hidden">
      {/* Left: persistent students list. */}
      <div className="flex min-h-0 flex-col xl:w-[360px] xl:flex-shrink-0 xl:border-r xl:border-white/10">
        <MyStudents students={students} />
      </div>

      {/* Right: the active student's detail, or the empty state. */}
      <div className="flex flex-col p-4 xl:min-h-0 xl:flex-1 xl:overflow-hidden xl:p-6">
        {children}
      </div>
    </div>
  );
}
