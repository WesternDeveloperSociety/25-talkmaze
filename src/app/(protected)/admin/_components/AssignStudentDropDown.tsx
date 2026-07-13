"use client";

import { useEffect, useState } from "react";
import { api, apiFetch } from "@/src/lib/api/routes";
import type { Student } from "../_types";

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
      const response = await apiFetch(api.courses.students(courseId), {
        method: "POST",
        json: { studentId: student.id },
      });
      if (!response.ok) return;
      setSelectedStudents((prev) => {
        if (prev.some((s) => s.id === student.id)) return prev;
        return [...prev, student];
      });
    } catch {
      // ignore
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
        const response = await apiFetch(api.students.list());
        const data = await response.json();
        if (Array.isArray(data?.students)) setStudents(data.students);
        else setStudents([]);
      } catch {
        setStudents([]);
      }
    }
    getStudents();
  }, []);

  const displayName = (s: Student) =>
    [s.first_name, s.last_name].filter(Boolean).join(" ") || `#${s.id}`;

  return (
    <div className="space-y-3">
      <div className="border border-gray-300 rounded bg-white shadow-sm max-h-40 overflow-y-auto">
        {students.length > 0 ? (
          students.map((student) => (
            <div
              key={student.id}
              onClick={() => onStudentClick(student)}
              className="px-3 py-2 min-h-11 text-xs text-gray-800 hover:bg-blue-100 cursor-pointer flex justify-between items-center"
            >
              <span>{displayName(student)}</span>
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
                  <div>{displayName(student)}</div>
                  <div className="text-gray-500">#{student.id}</div>
                </div>
                <button
                  type="button"
                  onClick={() => removeSelectedStudent(student.id)}
                  className="text-xs text-red-500 hover:text-red-700 min-h-11 px-2"
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
