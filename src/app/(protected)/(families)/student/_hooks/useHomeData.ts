"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/src/services/supabase/client";
import type { CoachingSession } from "@/src/lib/scheduling/types";
import { useActiveProfile } from "@/src/app/(protected)/(families)/_context/ActiveProfileContext";
import type { CoursePickerOption } from "@/src/components/common/lessons/CoursePicker";

type LessonSummary = {
  id: string;
  title: string;
  slug: string | null;
  next_lesson: string | null;
  slide_show_url: string | null;
};

export type HomeLesson = {
  id: string;
  title: string;
  slug: string | null;
  lessonNumber: number;
  slideShowUrl: string | null;
};

export type TokenRow = {
  id: string;
  title: string;
  icon_url: string | null;
  lesson_id: string | null;
};

export function useHomeData() {
  const router = useRouter();
  const profile = useActiveProfile();
  const [loading, setLoading] = useState(true);
  const [isSetupComplete, setIsSetupComplete] = useState<boolean | null>(null);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const [currentLesson, setCurrentLesson] = useState<HomeLesson | null>(null);
  const [prevLesson, setPrevLesson] = useState<HomeLesson | null>(null);
  const [nextLesson, setNextLesson] = useState<HomeLesson | null>(null);
  const [sessions, setSessions] = useState<CoachingSession[]>([]);
  const [courseTokens, setCourseTokens] = useState<TokenRow[]>([]);
  const [earnedTokenIds, setEarnedTokenIds] = useState(new Set<string>());
  const [courseBadgeUrl, setCourseBadgeUrl] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<CoursePickerOption[]>([]);
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient();

        if (!profile || profile.type !== "student") {
          router.push("/profiles");
          return;
        }

        const { data: studentData } = await supabase
          .from("students")
          .select("is_setup_complete, active_course_id")
          .eq("id", profile.id)
          .single();

        setIsSetupComplete(studentData?.is_setup_complete ?? null);

        const now = new Date().toISOString();
        const { data: sessionsRaw } = await supabase
          .from("sessions")
          .select(
            `id, start_time, end_time, students(first_name, last_name), coaches(first_name, last_name)`,
          )
          .eq("student_id", profile.id)
          .gte("start_time", now)
          .order("start_time", { ascending: true });

        const sessionIds = (sessionsRaw ?? []).map((s: any) => s.id as number);
        let markedSessionIds = new Set<number>();
        if (sessionIds.length > 0) {
          const { data: attendanceRaw } = await supabase
            .from("session_attendance")
            .select("session_id")
            .in("session_id", sessionIds);
          markedSessionIds = new Set(
            (attendanceRaw ?? [])
              .map((r: any) => r.session_id as number)
              .filter(Boolean),
          );
        }

        setSessions(
          (sessionsRaw ?? [])
            .filter((s: any) => !markedSessionIds.has(s.id))
            .map((s: any) => ({
              id: s.id.toString(),
              title: "Public Speaking Session",
              start_date: s.start_time,
              end_date: s.end_time,
              studentName: s.students
                ? `${s.students.first_name ?? ""} ${s.students.last_name ?? ""}`.trim()
                : "",
              coachName: s.coaches
                ? `${s.coaches.first_name ?? ""} ${s.coaches.last_name ?? ""}`.trim()
                : "",
              status: "scheduled",
            })),
        );

        const courseId = studentData?.active_course_id ?? null;
        setActiveCourseId(courseId);

        // Fetch the student's active assignments (for the course picker).
        const { data: assignmentsRaw } = await supabase
          .from("course_assignment")
          .select("course_id, courses(id, title)")
          .eq("student_id", profile.id)
          .eq("isActive", true);
        const opts: CoursePickerOption[] = (assignmentsRaw ?? [])
          .map((a: any) => {
            const cid = a.course_id;
            const title = a.courses?.title;
            return cid && title
              ? { course_id: cid, course_title: title }
              : null;
          })
          .filter(Boolean) as CoursePickerOption[];
        setAssignments(opts);

        if (!courseId) {
          setLoading(false);
          return;
        }

        const [
          { data: courseHeadData },
          { data: lessonsRaw },
          { data: progressData },
          { data: badgeData },
        ] = await Promise.all([
          supabase
            .from("courses")
            .select("head_lesson_id")
            .eq("id", courseId)
            .single(),
          supabase
            .from("lessons")
            .select("id, title, slug, next_lesson, slide_show_url")
            .eq("course_id", courseId),
          supabase
            .from("lesson_progress")
            .select("lesson_id, status")
            .eq("student_id", profile.id),
          supabase
            .from("badges")
            .select("image_url")
            .eq("course_id", courseId)
            .maybeSingle(),
        ]);

        setCourseBadgeUrl(badgeData?.image_url ?? null);

        // Traverse linked list from head to get lessons in display order
        const lessonMap = new Map((lessonsRaw ?? []).map((l) => [l.id, l]));
        const orderedLessons: LessonSummary[] = [];
        let cur: string | null = courseHeadData?.head_lesson_id ?? null;
        while (cur) {
          const node = lessonMap.get(cur);
          if (!node) break;
          orderedLessons.push(node);
          cur = node.next_lesson;
        }
        // Fallback if head is not set or list is broken
        const lessons: LessonSummary[] =
          orderedLessons.length > 0 ? orderedLessons : (lessonsRaw ?? []);
        // Restrict completions to lessons in the active course — soft-deleted
        // assignments leave behind lesson_progress rows that would otherwise
        // inflate the count.
        const courseLessonIds = new Set(lessons.map((l) => l.id));
        const completedIds = new Set(
          (progressData ?? [])
            .filter(
              (r: any) =>
                r.status === 3 && courseLessonIds.has(r.lesson_id as string),
            )
            .map((r: any) => r.lesson_id as string),
        );

        // Fetch tokens for this course and the student's earned tokens
        const lessonIds = lessons.map((l) => l.id);
        if (lessonIds.length > 0) {
          const [{ data: courseTokensData }, { data: earnedTokensData }] =
            await Promise.all([
              supabase
                .from("tokens")
                .select("id, title, icon_url, lesson_id")
                .in("lesson_id", lessonIds),
              supabase
                .from("student_tokens")
                .select("token_id")
                .eq("student_id", profile.id),
            ]);

          const orderedTokens = lessons
            .map((l) =>
              (courseTokensData ?? []).find((t: any) => t.lesson_id === l.id),
            )
            .filter(Boolean) as TokenRow[];

          setCourseTokens(orderedTokens);
          setEarnedTokenIds(
            new Set(
              (earnedTokensData ?? []).map((r: any) => r.token_id as string),
            ),
          );
        }

        const resolveSlideUrl = (raw: string | null): string | null => {
          if (!raw) return null;
          const clean = raw.replace(/^course_files\//, "");
          return supabase.storage.from("course_files").getPublicUrl(clean).data
            .publicUrl;
        };

        const toHomeLesson = (l: LessonSummary, index: number): HomeLesson => ({
          id: l.id,
          title: l.title,
          slug: l.slug,
          lessonNumber: index + 1,
          slideShowUrl: resolveSlideUrl(l.slide_show_url),
        });

        const currentIndex = lessons.findIndex((l) => !completedIds.has(l.id));

        setProgress({ completed: completedIds.size, total: lessons.length });

        if (currentIndex === -1) {
          setCurrentLesson(null);
          setPrevLesson(
            lessons.length > 0
              ? toHomeLesson(lessons[lessons.length - 1], lessons.length - 1)
              : null,
          );
          setNextLesson(null);
        } else {
          setCurrentLesson(toHomeLesson(lessons[currentIndex], currentIndex));
          setPrevLesson(
            currentIndex > 0
              ? toHomeLesson(lessons[currentIndex - 1], currentIndex - 1)
              : null,
          );
          setNextLesson(
            currentIndex < lessons.length - 1
              ? toHomeLesson(lessons[currentIndex + 1], currentIndex + 1)
              : null,
          );
        }
      } catch (err) {
        console.error("useHomeData error:", err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [profile, router, reloadKey]);

  return {
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
  };
}
