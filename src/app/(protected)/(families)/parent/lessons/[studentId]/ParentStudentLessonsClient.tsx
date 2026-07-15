"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import LessonCard from "@/src/components/common/lessons/LessonCard";
import LessonProgressCard from "@/src/components/common/lessons/LessonProgressCard";
import RichTextDisplay from "@/src/components/common/rich-text/RichTextDisplay";
import CoursePicker, {
  type CoursePickerOption,
} from "@/src/components/common/lessons/CoursePicker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";

export interface LessonProp {
  id: string;
  title: string;
  lessonNumber: number;
  tokenTitle: string | null;
  tokenIcon: string | null;
  isCompleted: boolean;
  isLocked: boolean;
  status: number;
  positiveFeedback: string | null;
  improvementFeedback: string | null;
}

interface Props {
  studentId: string;
  studentName: string;
  courseName: string | null;
  lessons: LessonProp[];
  progress: { completed: number; total: number };
  courseOptions?: CoursePickerOption[];
  activeCourseId?: string | null;
}

export default function ParentStudentLessonsClient({
  studentId,
  studentName,
  courseName,
  lessons,
  progress,
  courseOptions = [],
  activeCourseId = null,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [selectedLesson, setSelectedLesson] = useState<LessonProp | null>(null);

  return (
    <div className="w-full max-w-[1400px] mx-auto p-4 sm:p-6 md:p-12 flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-4">
        <Link
          href="/parent/lessons"
          className="flex items-center gap-1 text-white/70 hover:text-white transition-colors text-sm font-medium"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-4 h-4"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
          All Students
        </Link>
        <span className="text-white/30">/</span>
        <h1 className="text-white text-xl font-bold">
          {studentName}&apos;s Lessons
          {courseName && courseOptions.length <= 1 && (
            <span className="ml-2 text-sm font-normal text-white/50">
              {courseName}
            </span>
          )}
        </h1>
      </div>

      {courseOptions.length > 1 && (
        <CoursePicker
          studentId={studentId}
          options={courseOptions}
          activeCourseId={activeCourseId}
          onChange={(courseId) =>
            router.push(`${pathname}?course_id=${courseId}`)
          }
        />
      )}

      {lessons.length === 0 ? (
        <div className="bg-[#2B4257]/40 backdrop-blur-md rounded-3xl p-6 sm:p-12 flex flex-col items-center text-center gap-4 border border-[#B1E7D6]/20">
          <h2 className="text-2xl font-bold text-white">No Course Assigned</h2>
          <p className="text-[#B1E7D6] opacity-80 max-w-md">
            {studentName} hasn&apos;t been assigned to a course yet.
          </p>
        </div>
      ) : (
        <>
          {/* Progress bar */}
          <LessonProgressCard
            completed={progress.completed}
            total={progress.total}
            width="w-full"
          />

          {/* Lesson grid */}
          <div className="grid gap-6 grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(280px,1fr))] pb-12">
            {lessons.map((lesson) => (
              <LessonCard
                key={lesson.id}
                lessonNumber={lesson.lessonNumber}
                title={lesson.title}
                tokenTitle={lesson.tokenTitle}
                icon={lesson.tokenIcon}
                isCompleted={lesson.isCompleted}
                isLocked={lesson.isLocked}
                onClick={() => setSelectedLesson(lesson)}
              />
            ))}
          </div>
        </>
      )}

      {/* Feedback modal */}
      {selectedLesson && (
        <Dialog
          open
          onOpenChange={(o) => {
            if (!o) setSelectedLesson(null);
          }}
        >
          <DialogContent
            variant="light"
            size="lg"
            className="flex max-h-[85vh] flex-col"
          >
            <DialogHeader>
              <DialogTitle>{selectedLesson.title}</DialogTitle>
              <DialogDescription>
                Lesson {selectedLesson.lessonNumber}
              </DialogDescription>
            </DialogHeader>

            {/* Modal body */}
            <div className="-mx-6 flex flex-1 flex-col gap-4 overflow-y-auto px-6">
              {selectedLesson.status === 3 ? (
                <>
                  <RichTextDisplay
                    title="Highlights"
                    content={selectedLesson.positiveFeedback}
                  />
                  <RichTextDisplay
                    title="Areas to Improve"
                    content={selectedLesson.improvementFeedback}
                  />
                  {!selectedLesson.positiveFeedback &&
                    !selectedLesson.improvementFeedback && (
                      <p className="text-gray-400 text-sm text-center py-4">
                        No feedback has been written for this lesson yet.
                      </p>
                    )}
                </>
              ) : (
                <p className="text-gray-400 text-sm text-center py-4">
                  This lesson hasn&apos;t been completed yet.
                </p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
