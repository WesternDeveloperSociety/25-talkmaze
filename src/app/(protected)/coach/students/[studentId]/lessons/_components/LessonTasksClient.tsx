"use client";

import { useState } from "react";
import LessonCard from "@/src/app/(protected)/(families)/student/lessons/_components/LessonCard";
import CoursePicker from "@/src/components/common/CoursePicker";
import { SearchInput } from "@/src/components/ui/search-input";
import type { CourseLessonsForStudent } from "@/src/lib/lessons/server/getStudentLessonsByCourse";
import LessonStatusBadge from "./LessonStatusBadge";
import LessonDetailModal, { type LessonModalData } from "./LessonDetailModal";

interface Props {
  studentId: string;
  courses: CourseLessonsForStudent[];
  activeCourseId: string | null;
  /** Reward-token icon/title per lesson id, for the card's top-right token. */
  tokensByLesson: Record<string, { icon: string | null; title: string | null }>;
}

/**
 * Coach "Lesson Tasks" tab: a course-scoped grid of lesson cards. Clicking a
 * card opens a detail modal (resources + editable progress) with a link into
 * the full lesson editor. Switching courses is a client-only view filter — it
 * does not touch the student's stored active course.
 */
export default function LessonTasksClient({
  studentId,
  courses,
  activeCourseId,
  tokensByLesson,
}: Props) {
  const [selectedCourseId, setSelectedCourseId] = useState<string>(() => {
    if (activeCourseId && courses.some((c) => c.course_id === activeCourseId)) {
      return activeCourseId;
    }
    return courses[0]?.course_id ?? "";
  });

  // Seed each lesson's status from the loader; updated optimistically by the
  // modal so the card badge stays in sync across course switches.
  const [statusByLesson, setStatusByLesson] = useState<Record<string, number>>(
    () => {
      const map: Record<string, number> = {};
      for (const course of courses) {
        course.lessons.forEach((lesson, i) => {
          map[lesson.id] = course.status[i] ?? 1;
        });
      }
      return map;
    },
  );

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<LessonModalData | null>(null);

  const selectedCourse =
    courses.find((c) => c.course_id === selectedCourseId) ?? null;

  const courseOptions = courses.map((c) => ({
    course_id: c.course_id,
    course_title: c.course_name || "Untitled course",
  }));

  const cards = selectedCourse
    ? selectedCourse.lessons
        .map((lesson, index) => ({ lesson, index }))
        .filter(({ lesson }) =>
          lesson.title.toLowerCase().includes(search.toLowerCase()),
        )
    : [];

  const openLesson = (index: number) => {
    if (!selectedCourse) return;
    const lesson = selectedCourse.lessons[index];
    setSelected({
      lessonId: lesson.id,
      lessonNumber: index + 1,
      title: lesson.title,
      courseName: selectedCourse.course_name,
      description: lesson.description,
      preUrl: selectedCourse.pre_lesson_urls[index] ?? null,
      postUrl: selectedCourse.post_lesson_urls[index] ?? null,
      slideUrl: selectedCourse.slide_show_inputs[index] ?? null,
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-[#2B4257]/10 bg-white shadow-sm">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-[#2B4257]/10 bg-[#2B4257]/5 px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-[#2B4257]">Lessons</h2>
          <p className="mt-0.5 text-xs text-[#2B4257]/60">
            Select a lesson to view its details and update progress, tasks, and
            feedback.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <CoursePicker
            studentId={studentId}
            options={courseOptions}
            activeCourseId={selectedCourseId}
            variant="light"
            persist={false}
            onChange={setSelectedCourseId}
          />
          <div className="w-full sm:ml-auto sm:w-56">
            <SearchInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search lessons…"
              aria-label="Search lessons"
              variant="light"
              size="sm"
              iconSize={16}
              className="min-h-11 md:min-h-9"
            />
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        {courses.length === 0 ? (
          <p className="p-6 text-center text-sm text-gray-400">
            This student isn&apos;t assigned to any courses yet.
          </p>
        ) : cards.length === 0 ? (
          <p className="p-6 text-center text-sm text-gray-400">
            {search
              ? "No lessons match your search."
              : "No lessons in this course."}
          </p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-6">
            {cards.map(({ lesson, index }) => (
              <LessonCard
                key={lesson.id}
                lessonNumber={index + 1}
                title={lesson.title}
                icon={tokensByLesson[lesson.id]?.icon ?? "🧭"}
                tokenTitle={tokensByLesson[lesson.id]?.title ?? null}
                isLocked={false}
                statusSlot={
                  <LessonStatusBadge status={statusByLesson[lesson.id] ?? 1} />
                }
                onClick={() => openLesson(index)}
              />
            ))}
          </div>
        )}
      </div>

      {selected && (
        <LessonDetailModal
          studentId={studentId}
          lesson={selected}
          status={statusByLesson[selected.lessonId] ?? 1}
          onClose={() => setSelected(null)}
          onStatusChange={(lessonId, status) =>
            setStatusByLesson((prev) => ({ ...prev, [lessonId]: status }))
          }
        />
      )}
    </div>
  );
}
