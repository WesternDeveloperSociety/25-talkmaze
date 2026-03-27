"use client";

import { useCallback, useEffect, useState } from "react";

interface Course {
  id: string;
  title: string;
}

interface LessonProgress {
  lesson_id: string;
  status: number; // 1 = not started, 2 = in progress, 3 = done
  completed_at: string | null;
  coach_notes: string | null;
}

interface Lesson {
  id: string;
  title: string;
  description: string | null;
  content_url: string | null;
  created_at: string;
  courses: Course | null;
  progress?: LessonProgress | null;
}

interface LessonsTableProps {
  studentId?: string | null;
  studentName?: string | null;
}

const STATUS_LABELS: Record<number, string> = {
  1: "Not Started",
  2: "In Progress",
  3: "Completed",
};

const STATUS_STYLES: Record<number, string> = {
  1: "bg-gray-100 text-gray-600",
  2: "bg-yellow-100 text-yellow-700",
  3: "bg-green-100 text-green-700",
};

export default function LessonsTable({ studentId, studentName }: LessonsTableProps) {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchLessons = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = studentId
        ? `/api/coach/lessons?studentId=${studentId}`
        : "/api/coach/lessons";
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch lessons");
      const data = await response.json();
      setLessons(data);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    fetchLessons();
  }, [fetchLessons]);

  const handleStatusChange = async (lessonId: string, newStatus: number) => {
    if (!studentId) return;
    setUpdatingId(lessonId);
    try {
      const res = await fetch("/api/coach/lesson-progress", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: studentId, lesson_id: lessonId, status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed to update status");

      // Optimistically update local state
      setLessons(prev =>
        prev.map(l =>
          l.id === lessonId
            ? {
                ...l,
                progress: {
                  lesson_id: lessonId,
                  status: newStatus,
                  completed_at: newStatus === 3 ? new Date().toISOString() : null,
                  coach_notes: l.progress?.coach_notes ?? null,
                },
              }
            : l
        )
      );
    } catch (err: any) {
      alert("Error updating lesson status: " + err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const filtered = lessons.filter(l =>
    l.title.toLowerCase().includes(search.toLowerCase()) ||
    (l.courses?.title ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const showProgress = Boolean(studentId);

  return (
    <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-6 py-5 border-b bg-gray-50/50 flex justify-between items-center gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            {showProgress && studentName ? `Lessons — ${studentName}` : "All Lessons"}
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {showProgress
              ? "Track and update this student's lesson progress."
              : "Select a student above to see their progress."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="bg-blue-100 text-blue-700 text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap">
            {!loading ? `${filtered.length} lessons` : "Loading..."}
          </span>
          <input
            type="search"
            placeholder="Search lessons..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
          />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="p-8">
          <div className="animate-pulse space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-10 bg-gray-100 rounded w-full" />
            ))}
          </div>
        </div>
      ) : error ? (
        <div className="p-8 text-center text-red-600 text-sm">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="p-10 text-center text-gray-500 text-sm">
          {search ? "No lessons match your search." : "No lessons found."}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100 text-sm">
            <thead className="bg-gray-50 text-gray-600 uppercase text-xs tracking-wider">
              <tr>
                <th className="px-6 py-3 text-left font-medium">Lesson Title</th>
                <th className="px-6 py-3 text-left font-medium">Course</th>
                <th className="px-6 py-3 text-left font-medium">Description</th>
                <th className="px-6 py-3 text-left font-medium">Content</th>
                {showProgress && <th className="px-6 py-3 text-left font-medium">Progress</th>}
                <th className="px-6 py-3 text-left font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {filtered.map((lesson) => {
                const status = lesson.progress?.status ?? 1;
                const isUpdating = updatingId === lesson.id;
                return (
                  <tr key={lesson.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">
                      {lesson.title}
                    </td>
                    <td className="px-6 py-4 text-gray-600 whitespace-nowrap">
                      {lesson.courses?.title ?? (
                        <span className="text-gray-400 italic">No course</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-600 max-w-xs truncate">
                      {lesson.description ?? <span className="text-gray-400 italic">—</span>}
                    </td>
                    <td className="px-6 py-4">
                      {lesson.content_url ? (
                        <a
                          href={lesson.content_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium underline"
                        >
                          View
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                        </a>
                      ) : (
                        <span className="text-gray-400 italic">—</span>
                      )}
                    </td>
                    {showProgress && (
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {/* Status badge */}
                          <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${STATUS_STYLES[status]}`}>
                            {STATUS_LABELS[status]}
                          </span>
                          {/* Dropdown to change status */}
                          <select
                            disabled={isUpdating}
                            value={status}
                            onChange={e => handleStatusChange(lesson.id, Number(e.target.value))}
                            className="border border-gray-200 rounded-md text-xs py-1 px-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 cursor-pointer"
                          >
                            <option value={1}>Not Started</option>
                            <option value={2}>In Progress</option>
                            <option value={3}>Completed</option>
                          </select>
                          {isUpdating && (
                            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                          )}
                        </div>
                      </td>
                    )}
                    <td className="px-6 py-4 text-gray-500 whitespace-nowrap">
                      {new Date(lesson.created_at).toLocaleDateString("en-US", {
                        year: "numeric", month: "short", day: "numeric"
                      })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
