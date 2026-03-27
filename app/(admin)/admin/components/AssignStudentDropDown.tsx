"use client";

import { useEffect, useState } from "react";

export type Student = {
  id: string;
  account_id: string;
  name: string;
  created_at: string;
  updated_at: string;
  lesson_space_id: string | null;
  profile_access_pin: string | null;
  teach_works_url: string | null;
  lesson_space_teacher_link: string | null;
  lesson_space_student_link: string | null;
  remaining_lessons: number | null;
};

export type Coach = {
  id: string;
  account_id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

interface StudentProps {
  courseId: string;
}

export default function AssignStudentDropDown({ courseId }: StudentProps) {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<Student[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function onStudentClick(student: Student) {
    try {
      setLoadingId(student.id);

      const response = await fetch("/api/admin/courses/assign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          studentId: student.id,
          courseId: courseId,
        }),
      });

      if (!response.ok) {
        console.log("Failed to assign student");
        return;
      }

      setSelectedStudents((prev) => {
        const alreadyExists = prev.some((s) => s.id === student.id);
        if (alreadyExists) return prev;
        return [...prev, student];
      });
    } catch (err) {
      console.log("Error assigning student");
    } finally {
      setLoadingId(null);
    }
  }

  function removeSelectedStudent(studentId: string) {
    setSelectedStudents((prev) => prev.filter((s) => s.id !== studentId));
  }

  useEffect(() => {
    async function getStudents() {
      try {
        const response = await fetch("/api/admin/students");
        const data = await response.json();

        console.log("students response:", data);

        if (Array.isArray(data)) {
          setStudents(data);
        } else if (Array.isArray(data.data)) {
          setStudents(data.data);
        } else {
          setStudents([]);
        }
      } catch (err) {
        console.log("Error getting students");
        setStudents([]);
      }
    }

    getStudents();
  }, []);

  return (
    <div className="space-y-3">
      <div className="border border-gray-300 rounded bg-white shadow-sm max-h-40 overflow-y-auto">
        {students.length > 0 ? (
          students.map((student) => (
            <div
              key={student.id}
              onClick={() => onStudentClick(student)}
              className="px-3 py-2 text-xs text-gray-800 hover:bg-blue-100 cursor-pointer flex justify-between"
            >
              <span>{student.name}</span>
              <span className="text-gray-400">
                {loadingId === student.id ? "Assigning..." : `#${student.id}`}
              </span>
            </div>
          ))
        ) : (
          <div className="px-3 py-2 text-xs text-gray-500">
            No students found
          </div>
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">
          Selected Students
        </h3>

        {selectedStudents.length > 0 ? (
          <div className="space-y-2">
            {selectedStudents.map((student) => (
              <div
                key={student.id}
                className="flex items-center justify-between border border-gray-200 rounded px-3 py-2 bg-gray-50"
              >
                <div className="text-xs text-gray-900">
                  <div>{student.name}</div>
                  <div className="text-gray-500">#{student.id}</div>
                </div>

                <button
                  type="button"
                  onClick={() => removeSelectedStudent(student.id)}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-500">No students selected yet.</p>
        )}
      </div>
    </div>
  );
}