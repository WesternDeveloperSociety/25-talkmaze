"use client";

import { useEffect, useState } from "react";

interface Student {
  id: string;
  name: string;
  tw_id: string | null;
  lesson_space_id?: string | null;
}

interface MyStudentsProps {
  activeStudentId?: string | null;
  onStudentClick?: (student: Student) => void;
  onMessageClick?: (student: Student) => void; // ← new
}

export default function MyStudents({
  activeStudentId,
  onStudentClick,
  onMessageClick,
}: MyStudentsProps) {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStudents() {
      try {
        const response = await fetch("/api/coach/students");
        if (!response.ok) throw new Error("Failed to load students");
        const data = await response.json();
        setStudents(data);
      } catch (err: any) {
        setError(err.message || "An unexpected error occurred");
      } finally {
        setLoading(false);
      }
    }
    fetchStudents();
  }, []);

  if (loading) {
    return (
      <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
        <div className="px-6 py-5 border-b bg-gray-50/50">
          <h2 className="text-lg font-semibold text-gray-900">My Students</h2>
          <p className="text-sm text-gray-500 mt-1">
            Students assigned to you for coaching.
          </p>
        </div>
        <div className="p-6">
          <div className="animate-pulse flex space-x-4">
            <div className="flex-1 space-y-4 py-1">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded w-5/6"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white border border-red-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-6 py-5 border-b border-red-100 bg-red-50/50">
          <h2 className="text-lg font-semibold text-red-800">My Students</h2>
        </div>
        <div className="p-6 text-sm text-red-600">
          Error loading students: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border rounded-xl overflow-hidden shadow-sm h-full max-h-[700px] flex flex-col">
      <div className="px-6 py-5 border-b bg-gray-50/50 flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">My Students</h2>
          <p className="text-sm text-gray-500 mt-1">
            Students assigned to you for coaching.
          </p>
        </div>
        <span className="bg-blue-100 text-blue-700 text-xs font-medium px-2.5 py-1 rounded-full">
          {students.length} Total
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {students.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">
            You currently have no students assigned to you.
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {students.map((student) => {
              const isActive = student.id === activeStudentId;
              return (
                <li
                  key={student.id}
                  onClick={() => onStudentClick?.(student)}
                  className={`p-6 transition-colors cursor-pointer ${isActive ? "bg-blue-50/50" : "hover:bg-gray-50"}`}
                >
                  <div className="flex items-center justify-between">
                    <h3
                      className={`text-sm font-semibold ${isActive ? "text-blue-900" : "text-gray-900"}`}
                    >
                      {student.name}
                    </h3>
                    <div className="flex items-center gap-2">
                      {/* Message Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onMessageClick?.(student);
                        }}
                        className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                      >
                        Message
                      </button>

                      {/* Lesson Space Button */}
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();

                          try {
                            const res = await fetch(
                              "/api/webhooks/stripe/learningSpace",
                              {
                                method: "POST",
                                headers: {
                                  "Content-Type": "application/json",
                                },
                                body: JSON.stringify({
                                  student_id: student.id,
                                }),
                              },
                            );

                            const data = await res.json();
                            console.log(data);

                            if (data?.url) {
                              window.location.href = data.url;
                            }
                          } catch (err) {
                            console.error(err);
                          }
                        }}
                        disabled={!student.lesson_space_id}
                        className={`inline-flex items-center px-3 py-1.5 text-xs font-medium rounded transition-colors
                                    ${
                                      student.lesson_space_id
                                        ? "text-white bg-green-600 hover:bg-green-700"
                                        : "text-gray-400 bg-gray-200 cursor-not-allowed"
                                    }`}
                      >
                        Lesson Space
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
