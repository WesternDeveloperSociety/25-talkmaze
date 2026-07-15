"use client";

import { useState } from "react";
import Link from "next/link";
import StudentProfileCard from "./StudentProfileCard";
import StudentPostLessonTaskSettings from "./StudentPostLessonTaskSettings";
import StudentAttendanceDetails, {
  AttendanceItem,
} from "./StudentAttendanceDetails";
import SelectedStudentSubscriptionStatus from "./SelectedStudentSubscriptionStatus";
import ScheduleList from "../../_components/upcoming-schedule/ScheduleList";
import type { CoachingSession } from "@/src/lib/scheduling/types";

export interface Student {
  id: string;
  name: string;
  first_name: string | null;
  last_name: string | null;
  grade: string | number | null;
  avatar_url: string | null;
  location: string | null;
  date_of_birth: string | null;
  bio: string | null;
  remaining_lessons: number;
  total_lessons: number;
  status: string;
  is_setup_complete: boolean | null;
}

interface Props {
  students: Student[];
  schedule: CoachingSession[];
  attendanceByStudent: Record<string, AttendanceItem[]>;
  streakByStudent: Record<string, number>;
}

/**
 * Parent Dashboard client component.
 *
 * Passes data down to the sub-components (attendance, schedule, etc).
 * Renders all the sub components of the page in the correct layout.
 */
export default function ParentDashboardClient({
  students,
  schedule,
  attendanceByStudent,
  streakByStudent,
}: Props) {
  const [currentStudentIndex, setCurrentStudentIndex] = useState(0);

  const onNextStudent = () => {
    if (students.length > 1) {
      setCurrentStudentIndex((prev) => (prev + 1) % students.length);
    }
  };

  const onPrevStudent = () => {
    if (students.length > 1) {
      setCurrentStudentIndex(
        (prev) => (prev - 1 + students.length) % students.length,
      );
    }
  };

  const currentStudent = students[currentStudentIndex] ?? ({} as Student);
  const incompleteStudents = students.filter(
    (s) => s.is_setup_complete === false,
  );

  return (
    <div className="w-full h-full p-4 lg:p-8 overflow-y-auto">
      {incompleteStudents.length > 0 && (
        <div className="mb-5 flex flex-col gap-2">
          {incompleteStudents.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between gap-4 rounded-xl px-5 py-4 bg-[#FFF8E6] border border-[#F5A623]/30"
            >
              <div>
                <p className="font-semibold text-[#2B4257] text-sm">
                  {s.first_name} {s.last_name}&apos;s profile is incomplete.
                </p>
                <p className="text-xs text-[#2B4257]/60 mt-0.5">
                  Set up their availability so we can match them with a coach.
                </p>
              </div>
              <Link
                href={`/onboarding?studentId=${s.id}`}
                className="shrink-0 px-4 py-2 bg-[#B1E7D6] rounded-lg text-sm font-semibold text-[#2B4257] hover:opacity-90 transition-opacity whitespace-nowrap"
              >
                Complete Setup
              </Link>
            </div>
          ))}
        </div>
      )}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_1.3fr] gap-6 xl:h-full min-h-0">
        {/* Left column */}
        <div className="flex flex-col gap-[22px] xl:h-full min-h-0">
          <div className="flex-3 min-h-[280px] xl:min-h-0">
            <StudentProfileCard
              name={
                currentStudent.first_name ||
                currentStudent.name ||
                "Select Student"
              }
              location={currentStudent.location || "Location"}
              dob={currentStudent.date_of_birth || "Not set"}
              grade={currentStudent.grade || "N/A"}
              description={currentStudent.bio || ""}
              imageUrl={currentStudent.avatar_url || undefined}
              onNext={students.length > 1 ? onNextStudent : undefined}
              onPrev={students.length > 1 ? onPrevStudent : undefined}
              currentIndex={currentStudentIndex}
              totalStudents={students.length}
            />
          </div>

          <div className="flex-2 min-h-[140px] xl:min-h-0">
            <StudentPostLessonTaskSettings studentId={currentStudent.id} />
          </div>

          <div className="flex-2 min-h-[180px] xl:min-h-0">
            <StudentAttendanceDetails
              streak={streakByStudent[currentStudent.id] ?? 0}
              attendance={
                attendanceByStudent[currentStudent.id] ??
                Array.from({ length: 12 }, () => ({
                  status: "future" as const,
                }))
              }
            />
          </div>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-6 min-h-0">
          <SelectedStudentSubscriptionStatus
            sessionsLeft={currentStudent.remaining_lessons ?? 0}
            totalSessions={currentStudent.total_lessons ?? 0}
            studentId={currentStudent.id}
            subscriptionStatus={currentStudent.status}
          />

          <div className="flex-1 min-h-[200px] xl:min-h-0">
            <ScheduleList
              schedule={schedule.filter(
                (s) => s.student_id === currentStudent.id,
              )}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
