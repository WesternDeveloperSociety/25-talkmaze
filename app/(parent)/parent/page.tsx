"use client";

import React, { useEffect, useState } from "react";
import StudentProfileCard from "./components/StudentProfileCard";
import PostLessonTasks from "./components/PostLessonTasks";
import AttendanceStreak from "./components/AttendanceStreak";
import PaymentStatus from "./components/PaymentStatus";
import ScheduleList from "../components/ScheduleList";
import { Appointment } from "../types/lesson";

export default function ParentDashboard() {
  const [schedule, setSchedule] = useState<Appointment[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [currentStudentIndex, setCurrentStudentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        // Fetch Lessons (Family-wide)
        const lessonsResponse = await fetch("/api/teachworks/family-lessons");
        if (lessonsResponse.ok) {
          const lessonsData = await lessonsResponse.json();
          const mappedSchedule: Appointment[] = lessonsData.map((lesson: any) => {
              const fullStudentName = lesson.supabase_student_name || (lesson.participants?.[0]?.student_name) || "Student";
              let studentFirstName = "";
              if (fullStudentName.includes(",")) {
                  studentFirstName = fullStudentName.split(",")[1].trim().split(" ")[0];
              } else {
                  studentFirstName = fullStudentName.split(" ")[0];
              }
              return {
                  id: lesson.id.toString(),
                  title: lesson.service_name || lesson.name,
                  start_date: lesson.from_datetime,
                  end_date: lesson.to_datetime,
                  description: lesson.description,
                  studentName: studentFirstName,
                  coachName: lesson.employee_name,
                  status: lesson.status
              };
          });
          setSchedule(mappedSchedule);
        }

        // Fetch Students (Specific to this parent)
        const studentsResponse = await fetch("/api/parent/students");
        if (studentsResponse.ok) {
           const studentsData = await studentsResponse.json();
           setStudents(studentsData);
        }

      } catch (err: any) {
        console.error("Error fetching dashboard data:", err);
        setError("Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const onNextStudent = () => {
    if (students.length > 1) {
      setCurrentStudentIndex((prev) => (prev + 1) % students.length);
    }
  };

  const onPrevStudent = () => {
    if (students.length > 1) {
      setCurrentStudentIndex((prev) => (prev - 1 + students.length) % students.length);
    }
  };

  if (loading) {
    return (
      <div className="w-full h-full p-4 lg:p-6 flex items-center justify-center bg-[#1f2e3b]">
        <div className="text-white text-xl">Loading dashboard...</div>
      </div>
    );
  }

  const currentStudent = students[currentStudentIndex] || {};

  return (
    <div className="w-full h-full p-4 lg:p-6 overflow-y-auto bg-[#1f2e3b] animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-[1.2fr_1fr] gap-6">
        
        {/* Left Column */}
        <div className="flex flex-col gap-6">
           <div className="h-[240px]">
                <StudentProfileCard 
                    name={currentStudent.first_name || currentStudent.name || "Select Student"}
                    location={currentStudent.location || "Location"}
                    dob={currentStudent.date_of_birth || "Not set"}
                    grade={currentStudent.grade || "N/A"}
                    description={currentStudent.notes || "Sweet and outgoing personality"}
                    glows="Excited to learn and share"
                    grows="Clarity with content"
                    onNext={students.length > 1 ? onNextStudent : undefined}
                    onPrev={students.length > 1 ? onPrevStudent : undefined}
                    currentIndex={currentStudentIndex}
                    totalStudents={students.length}
                />
           </div>

           <div className="h-[200px]">
                <PostLessonTasks studentId={currentStudent.id} />
           </div>

           <div className="h-[200px]">
                <AttendanceStreak streak={8} studentId={currentStudent.id} />
           </div>
        </div>

        {/* Right Column */}
        <div className="flex flex-col gap-6">
            <div className="flex-1">
                <PaymentStatus sessionsLeft={currentStudent.remaining_lessons} studentId={currentStudent.id} />
            </div>

            <div className="flex-1 min-h-[516px] bg-[#B1E7D6] rounded-2xl p-6 shadow-[0_4px_4px_rgba(0,0,0,0.25)]">
                <ScheduleList schedule={schedule} />
            </div>
        </div>

      </div>
    </div>
  );
}
