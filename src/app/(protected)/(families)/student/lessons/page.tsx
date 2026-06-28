"use client";

import { useMemo } from "react";
import { useLessons } from "./_hooks/useLessons";
import { useDocumentTitle } from "@/src/hooks/useDocumentTitle";
import PageSpinner from "@/src/components/ui/PageSpinner";
import { Alert } from "@/src/components/ui/alert";
import LessonProgressCard from "@/src/components/common/lessons/LessonProgressCard";
import TokensRow from "./_components/TokensRow";
import LessonCard from "@/src/components/common/lessons/LessonCard";
import CoursePicker from "@/src/components/common/lessons/CoursePicker";
import { useActiveProfile } from "@/src/app/(protected)/(families)/_context/ActiveProfileContext";

export default function LessonsPage() {
  useDocumentTitle("Lessons");
  const profile = useActiveProfile();
  const {
    lessons,
    loading,
    error,
    progress,
    courseTokens,
    earnedTokenIds,
    completedLessonIds,
    hasCourse,
    isSetupComplete,
    navigateToLesson,
    assignments,
    activeCourseId,
    reload,
  } = useLessons();

  const firstIncompleteIdx = lessons.findIndex(
    (l) => !completedLessonIds.has(l.id),
  );

  const lessonCards = useMemo(
    () =>
      lessons.map((lesson, index) => {
        const token = courseTokens.find((t) => t.lesson_id === lesson.id);
        const isLocked =
          firstIncompleteIdx !== -1 && index > firstIncompleteIdx;
        return {
          lesson,
          lessonNumber: index + 1,
          icon: token?.icon_url ?? "🧭",
          tokenTitle: token?.title ?? null,
          isCompleted: completedLessonIds.has(lesson.id),
          isLocked,
        };
      }),
    [lessons, completedLessonIds, courseTokens, firstIncompleteIdx],
  );

  if (loading) {
    return <PageSpinner />;
  }

  if (error) {
    return (
      <div className="w-full max-w-[1400px] p-6 md:p-12 mx-auto text-white">
        <Alert variant="destructive" className="rounded-2xl p-6">
          Error loading lessons: {error}
        </Alert>
      </div>
    );
  }

  if (!hasCourse) {
    if (isSetupComplete === false) {
      return (
        <div className="w-full max-w-[1400px] p-6 md:p-12 mx-auto text-white mt-10">
          <div className="bg-[#2B4257]/40 backdrop-blur-md rounded-3xl p-12 flex flex-col items-center text-center gap-6 border border-[#B1E7D6]/20 shadow-2xl">
            <h2 className="text-4xl font-bold text-white tracking-tight">
              Setup Required
            </h2>
            <p className="text-[#B1E7D6] text-lg max-w-md mx-auto opacity-80">
              Your profile hasn&apos;t been set up yet. Ask your parent to
              enter the parent dashboard and complete your profile setup so we
              can match you with a coach.
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="w-full max-w-[1400px] p-6 md:p-12 mx-auto text-white mt-10">
        <div className="bg-[#2B4257]/40 backdrop-blur-md rounded-3xl p-12 flex flex-col items-center text-center gap-6 border border-[#B1E7D6]/20 shadow-2xl">
          <h2 className="text-4xl font-bold text-white tracking-tight">
            No Course Assigned
          </h2>
          <p className="text-[#B1E7D6] text-lg max-w-md mx-auto opacity-80">
            It looks like you haven&apos;t been assigned to any courses yet.
            Start your learning journey today and unlock your potential!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1400px] p-6 md:p-12 flex flex-col gap-8 mx-auto text-white">
      {profile?.type === "student" && assignments.length > 1 && (
        <CoursePicker
          studentId={profile.id}
          options={assignments}
          activeCourseId={activeCourseId}
          persist
          onChange={reload}
        />
      )}
      <div className="flex flex-col lg:flex-row gap-6 w-full">
        <div className="grow">
          <LessonProgressCard
            completed={progress.completed}
            total={progress.total}
            width="w-full"
          />
        </div>
        <div className="w-full lg:w-[320px] shrink-0">
          <TokensRow
            courseTokens={courseTokens}
            earnedTokenIds={earnedTokenIds}
          />
        </div>
      </div>

      <div className="grid gap-6 grid-cols-[repeat(auto-fit,minmax(280px,1fr))] pb-12 animate-in fade-in duration-300">
        {lessonCards.map(
          ({
            lesson,
            lessonNumber,
            icon,
            tokenTitle,
            isCompleted,
            isLocked,
          }) => (
            <LessonCard
              key={lesson.id}
              lessonNumber={lessonNumber}
              title={lesson.title}
              tokenTitle={tokenTitle}
              icon={icon}
              isCompleted={isCompleted}
              isLocked={isLocked}
              onClick={() => navigateToLesson(lesson)}
            />
          ),
        )}
      </div>
    </div>
  );
}
