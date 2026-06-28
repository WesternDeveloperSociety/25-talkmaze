"use client";

import { useCallback, useEffect, useState } from "react";
import AssignCourseModal from "./AssignCourseModal";
import type { CoachCourseListItem } from "./types";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import type { Database } from "@/src/services/supabase/types/database";

type Student = Database["public"]["Tables"]["students"]["Row"];

/**
 * Courses tab body: lists the student's active courses and opens the existing
 * AssignCourseModal (reused untouched) for assign/unassign.
 */
export default function CoursesPanel({ student }: { student: Student }) {
  const [courses, setCourses] = useState<CoachCourseListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [message, setMessage] = useState<{
    type: "error" | "success";
    text: string;
  } | null>(null);

  const loadCourses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/coach/courses?student_id=${student.id}`);
      if (!res.ok) throw new Error("Failed to load courses");
      const data = await res.json();
      setCourses(
        Array.isArray(data?.courses)
          ? (data.courses as CoachCourseListItem[])
          : [],
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load courses");
    } finally {
      setLoading(false);
    }
  }, [student.id]);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  const assigned = courses.filter((c) => c.assignment?.isActive);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#2B4257]">
          Assigned courses
        </h3>
        <Button size="sm" onClick={() => setIsAssignOpen(true)}>
          Assign Course
        </Button>
      </div>

      {message && (
        <p
          className={`text-xs ${
            message.type === "error" ? "text-red-600" : "text-emerald-700"
          }`}
        >
          {message.text}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-gray-400">Loading courses…</p>
      ) : assigned.length === 0 ? (
        <Card variant="light" padding="md" shadow="sm">
          <p className="text-sm text-[#2B4257]/60">No courses assigned yet.</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {assigned.map((course) => (
            <Card
              key={course.id}
              variant="light"
              padding="sm"
              shadow="sm"
              className="flex-row items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="truncate font-semibold text-[#1F2E3B]">
                  {course.title}
                </p>
                {course.description && (
                  <p className="truncate text-sm text-[#2B4257]/60">
                    {course.description}
                  </p>
                )}
              </div>
              <span className="shrink-0 text-sm font-medium text-[#2B4257]">
                {course.assignment?.progress ?? 0}%
              </span>
            </Card>
          ))}
        </div>
      )}

      {isAssignOpen && (
        <AssignCourseModal
          student={student}
          courses={courses}
          coursesLoading={loading}
          coursesError={error}
          setIsAssigningCourse={setIsAssignOpen}
          onAssignedMessage={(m) => setMessage(m)}
          onAssigned={loadCourses}
        />
      )}
    </div>
  );
}
