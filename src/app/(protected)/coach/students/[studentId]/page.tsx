import Link from "next/link";
import { notFound } from "next/navigation";
import CourseProgressCard from "@/src/components/common/lessons/CourseProgressCard";
import { Button } from "@/src/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import { getCoachDashboardContext } from "../_lib/getCoachDashboardContext";
import { getStudentOverview } from "./_lib/getStudentOverview";
import { fullName } from "@/src/utils/formatName";
import type { Metadata } from "next";
import OverviewAbout from "./_components/OverviewAbout";
import OverviewUpcomingSessions from "./_components/OverviewUpcomingSessions";

interface OverviewPageProps {
  params: Promise<{ studentId: string }>;
}

export async function generateMetadata({
  params,
}: OverviewPageProps): Promise<Metadata> {
  const { studentId } = await params;
  try {
    const { students } = await getCoachDashboardContext();
    const student = students.find((s) => s.id === studentId);
    if (!student) return { title: "Student" };
    return {
      title: fullName(student.first_name, student.last_name, "Student"),
    };
  } catch {
    return { title: "Student" };
  }
}

export default async function CoachStudentOverviewPage({
  params,
}: OverviewPageProps) {
  const { studentId } = await params;

  // Ownership gate via the cached context
  const { students } = await getCoachDashboardContext();

  if (!students.some((s) => s.id === studentId)) notFound();

  const overview = await getStudentOverview(studentId);
  if (!overview) notFound();

  const coursesHref = `/coach/students/${studentId}/courses`;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <OverviewAbout
          bio={overview.bio}
          sessionsRemaining={overview.sessionsRemaining}
          sessionsTotal={overview.sessionsTotal}
          streak={overview.streak}
          preferredTime={overview.preferredTime}
          parentName={overview.parentName}
        />

        {overview.activeCourse ? (
          <CourseProgressCard
            heading="Active course"
            badgeUrl={overview.activeCourse.badgeUrl}
            title={overview.activeCourse.title}
            description={overview.activeCourse.description}
            completedLessons={overview.activeCourse.completedLessons}
            totalLessons={overview.activeCourse.totalLessons}
            currentLessonTitle={overview.activeCourse.currentLessonTitle}
            currentLessonNumber={overview.activeCourse.currentLessonNumber}
            manageHref={coursesHref}
          />
        ) : (
          <Card variant="light" padding="md" shadow="md" className="gap-3">
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-[#2B4257]">
                Active course
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-start gap-3">
              <p className="text-sm text-[#2B4257]/60">
                No active course assigned yet.
              </p>
              <Button asChild variant="outline-light" size="sm">
                <Link href={coursesHref}>Assign a course</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <OverviewUpcomingSessions sessions={overview.upcomingSessions} />
    </div>
  );
}
