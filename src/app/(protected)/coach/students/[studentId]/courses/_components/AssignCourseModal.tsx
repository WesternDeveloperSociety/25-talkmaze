import { useState } from "react";
import { api, apiFetch } from "@/src/lib/api/routes";
import { fullName } from "@/src/utils/formatName";
import { fmtLocalDate } from "@/src/utils/formatDateTime";
import type { CoachCourseListItem } from "./types";
import type { Database } from "@/src/services/supabase/types/database";

type Student = Database["public"]["Tables"]["students"]["Row"];

interface AssignCourseModalProps {
  student: Student;
  courses: CoachCourseListItem[];
  coursesLoading: boolean;
  coursesError: string | null;
  setIsAssigningCourse: React.Dispatch<React.SetStateAction<boolean>>;
  onAssignedMessage: (message: {
    type: "error" | "success";
    text: string;
  }) => void;
  onAssigned: () => void;
}

export default function AssignCourseModal({
  student,
  courses,
  coursesLoading,
  coursesError,
  setIsAssigningCourse,
  onAssignedMessage,
  onAssigned,
}: AssignCourseModalProps) {
  const [assigningCourseId, setAssigningCourseId] = useState<string | null>(
    null,
  );
  const [unassigningCourseId, setUnassigningCourseId] = useState<string | null>(
    null,
  );
  const [confirmingUnassignId, setConfirmingUnassignId] = useState<
    string | null
  >(null);
  const [inlineError, setInlineError] = useState<string | null>(null);

  const studentName = fullName(
    student.first_name,
    student.last_name,
    "this student",
  );

  const busy = assigningCourseId != null || unassigningCourseId != null;

  const assignedCourses = courses.filter((c) => c.assignment?.isActive);
  const availableCourses = courses.filter((c) => !c.assignment?.isActive);

  async function assignStudent(course: CoachCourseListItem) {
    setInlineError(null);
    setAssigningCourseId(course.id);
    try {
      const res = await apiFetch(api.courses.students(course.id), {
        method: "POST",
        json: { studentId: student.id },
      });

      if (!res.ok) {
        throw new Error("Failed to assign course. Please try again.");
      }

      onAssignedMessage({
        type: "success",
        text: `Assigned "${course.title}" to ${studentName}.`,
      });
      onAssigned();
    } catch (err: unknown) {
      setInlineError(
        err instanceof Error ? err.message : "Failed to assign course.",
      );
      onAssignedMessage({
        type: "error",
        text: `Could not assign "${course.title}" to ${studentName}.`,
      });
    } finally {
      setAssigningCourseId(null);
    }
  }

  async function unassignStudent(course: CoachCourseListItem) {
    setInlineError(null);
    setUnassigningCourseId(course.id);
    try {
      const res = await apiFetch(api.courses.student(course.id, student.id), {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Failed to unassign course. Please try again.");
      }

      onAssignedMessage({
        type: "success",
        text: `Unassigned "${course.title}" from ${studentName}.`,
      });
      setConfirmingUnassignId(null);
      onAssigned();
    } catch (err: unknown) {
      setInlineError(
        err instanceof Error ? err.message : "Failed to unassign course.",
      );
      onAssignedMessage({
        type: "error",
        text: `Could not unassign "${course.title}" from ${studentName}.`,
      });
    } finally {
      setUnassigningCourseId(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={() => setIsAssigningCourse(false)}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="px-6 py-5 border-b border-[#2B4257]/10 bg-[#2B4257]/5 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-[#2B4257]">
              Assign Course
            </h2>
            <p className="text-xs text-[#2B4257]/60 mt-0.5">
              Manage courses for {studentName}
            </p>
          </div>
          <button
            onClick={() => setIsAssigningCourse(false)}
            aria-label="Close"
            className="min-h-11 min-w-11 md:min-h-0 md:min-w-0 inline-flex items-center justify-center p-1.5 rounded-lg text-[#2B4257]/50 hover:text-[#2B4257] hover:bg-[#2B4257]/10 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Course list */}
        <div className="overflow-y-auto flex-1 p-4 space-y-5">
          {inlineError && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {inlineError}
            </p>
          )}

          {coursesLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, idx) => (
                <div
                  key={idx}
                  className="h-24 rounded-xl border border-gray-100 bg-gray-50 animate-pulse"
                />
              ))}
            </div>
          ) : coursesError ? (
            <p className="text-sm text-red-600 text-center py-10">
              {coursesError}
            </p>
          ) : courses.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">
              No courses available.
            </p>
          ) : (
            <>
              {/* Currently assigned */}
              {assignedCourses.length > 0 && (
                <section>
                  <h3 className="text-xs font-semibold text-[#2B4257]/70 uppercase tracking-wide mb-2">
                    Currently assigned ({assignedCourses.length})
                  </h3>
                  <div className="space-y-3">
                    {assignedCourses.map((course) => {
                      const isConfirming = confirmingUnassignId === course.id;
                      const isUnassigning = unassigningCourseId === course.id;
                      const assignment = course.assignment!;
                      return (
                        <div
                          key={course.id}
                          className="rounded-xl border border-gray-200 bg-gray-50 p-4"
                        >
                          <h4 className="text-sm font-semibold text-gray-900">
                            {course.title}
                          </h4>
                          <p className="text-xs text-emerald-700 font-medium mt-1">
                            ✓ Assigned {fmtLocalDate(assignment.assigned_at)}
                            {" · "}
                            {assignment.progress}% complete
                          </p>
                          {isConfirming ? (
                            <div className="mt-3 flex gap-2">
                              <button
                                disabled={busy}
                                onClick={() => setConfirmingUnassignId(null)}
                                className="flex-1 min-h-11 md:min-h-0 border border-gray-300 text-gray-700 text-xs font-medium py-2 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
                              >
                                Cancel
                              </button>
                              <button
                                disabled={busy}
                                onClick={() => unassignStudent(course)}
                                className="flex-1 min-h-11 md:min-h-0 bg-red-600 text-white text-xs font-medium py-2 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                              >
                                {isUnassigning
                                  ? "Unassigning..."
                                  : "Confirm unassign"}
                              </button>
                            </div>
                          ) : (
                            <button
                              disabled={busy}
                              onClick={() => setConfirmingUnassignId(course.id)}
                              className="mt-3 w-full min-h-11 md:min-h-0 border border-red-300 text-red-700 text-xs font-medium py-2 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                            >
                              Unassign
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Available */}
              {availableCourses.length > 0 ? (
                <section>
                  <h3 className="text-xs font-semibold text-[#2B4257]/70 uppercase tracking-wide mb-2">
                    Available courses
                  </h3>
                  <div className="space-y-3">
                    {availableCourses.map((course) => {
                      const wasAssigned =
                        course.assignment != null &&
                        !course.assignment.isActive;
                      return (
                        <div
                          key={course.id}
                          className="rounded-xl border border-[#2B4257]/10 p-4 hover:border-[#2B4257]/25 hover:shadow-sm transition-all"
                        >
                          <h4 className="text-sm font-semibold text-gray-900">
                            {course.title}
                          </h4>
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                            {course.description || "No description provided."}
                          </p>
                          {wasAssigned ? (
                            <p className="text-xs text-amber-700 mt-1">
                              Previously assigned · progress will be restored
                            </p>
                          ) : (
                            <p className="text-xs text-gray-400 mt-1">
                              Created{" "}
                              {new Date(course.created_at).toLocaleDateString()}
                            </p>
                          )}
                          <button
                            disabled={busy}
                            onClick={() => assignStudent(course)}
                            className="mt-3 w-full min-h-11 md:min-h-0 bg-[#2B4257] text-white text-xs font-medium py-2 rounded-lg hover:bg-[#2B4257]/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {assigningCourseId === course.id
                              ? "Assigning..."
                              : "Assign This Course"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ) : (
                assignedCourses.length > 0 && (
                  <p className="text-sm text-gray-400 text-center py-4">
                    No other courses available.
                  </p>
                )
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
