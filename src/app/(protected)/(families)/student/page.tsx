"use client";

import { useRouter } from "next/navigation";
import PageSpinner from "@/src/components/ui/PageSpinner";
import LessonProgressBar from "@/src/app/(protected)/(families)/_components/LessonProgressBar";
import TokenBar from "@/src/app/(protected)/(families)/_components/TokensBar";
import CoursePicker from "@/src/components/common/CoursePicker";
import { useActiveProfile } from "@/src/app/(protected)/(families)/_context/ActiveProfileContext";
import ReviewLessonCard from "./_components/ReviewLesson";
import NextLessonCard from "./_components/UpNextLesson";
import ScheduleList from "../_components/upcoming-schedule/ScheduleList";
import CurrentLessonBanner from "./_components/CurrentLessonBanner";
import { AspectRatio } from "@/src/components/ui/aspect-ratio";
import { useHomeData } from "./_hooks/useHomeData";
import { useDocumentTitle } from "@/src/hooks/useDocumentTitle";

function lessonPath(lesson: { slug: string | null; id: string }) {
  return `/student/lessons/${lesson.slug ?? lesson.id}`;
}

export default function Home() {
  useDocumentTitle("Student Dashboard");
  const router = useRouter();
  const profile = useActiveProfile();

  const {
    loading,
    isSetupComplete,
    progress,
    currentLesson,
    prevLesson,
    nextLesson,
    sessions,
    courseTokens,
    earnedTokenIds,
    courseBadgeUrl,
    assignments,
    activeCourseId,
    reload,
  } = useHomeData();

  if (loading) {
    return <PageSpinner />;
  }

  return (
    <div className="mx-auto h-full w-full overflow-y-auto p-4 sm:p-6 lg:p-8 2xl:px-24">
      <div className="mx-auto w-full max-w-[1300px]">
        {/* Course Select */}
        {profile?.type === "student" && assignments.length > 1 && (
          <div className="mb-4 w-full">
            <CoursePicker
              studentId={profile.id}
              options={assignments}
              activeCourseId={activeCourseId}
              persist
              onChange={reload}
            />
          </div>
        )}
        {/* Main Content Grid */}
        <div className="grid w-full grid-cols-1 gap-6 xl:min-h-full xl:grid-cols-[1fr_auto]">
          {/* Left Content - Progress, Banner, Next/Prev Lessons */}
          <div className="flex min-h-0 min-w-0 w-full flex-col gap-6 xl:min-h-full">
            <LessonProgressBar
              current={progress.completed}
              total={progress.total}
            />

            <AspectRatio ratio={16 / 9}>
              <CurrentLessonBanner
                lesson={currentLesson}
                courseBadgeUrl={courseBadgeUrl}
                isSetupComplete={isSetupComplete}
                hasCourse={Boolean(activeCourseId)}
                onClick={
                  currentLesson
                    ? () => router.push(lessonPath(currentLesson))
                    : undefined
                }
              />
            </AspectRatio>

            <div className="grid w-full gap-6 sm:gap-8 grid-cols-1 lg:grid-cols-2">
              {prevLesson && (
                <ReviewLessonCard
                  lessonNumber={prevLesson.lessonNumber}
                  title={prevLesson.title}
                  onClick={() => router.push(lessonPath(prevLesson))}
                />
              )}
              {nextLesson && (
                <NextLessonCard
                  lessonNumber={nextLesson.lessonNumber}
                  title={nextLesson.title}
                  onClick={() => router.push(lessonPath(nextLesson))}
                />
              )}
            </div>
          </div>
          {/* Right Content - Reward Tokens, Schedule */}
          <div className="flex flex-col gap-6 xl:h-full xl:min-h-0">
            <TokenBar
              courseTokens={courseTokens}
              earnedTokenIds={earnedTokenIds}
            />
            <div className="min-h-0 flex-1">
              <ScheduleList schedule={sessions} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
