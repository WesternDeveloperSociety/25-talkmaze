"use client";

import { useState } from "react";

export interface CoursePickerOption {
  course_id: string;
  course_title: string;
}

interface CoursePickerProps {
  studentId: string;
  options: CoursePickerOption[];
  activeCourseId: string | null;
  /**
   * When provided, the picker calls PATCH /api/student/active-course on
   * change and persists the selection to the student row. Used by the
   * student-side mount points.
   *
   * When omitted, the picker only fires `onChange` — the caller is
   * responsible for whatever client-only state it wants (e.g. the parent
   * dashboard pushes `?course_id=` into the URL without touching the
   * student's stored selection).
   */
  persist?: boolean;
  /**
   * Surface theme. `dark` (default) suits the family dashboard's dark panels;
   * `light` suits the coach content area (white cards), where the dark styling
   * would be invisible.
   */
  variant?: "light" | "dark";
  onChange: (courseId: string) => void;
}

export default function CoursePicker({
  studentId,
  options,
  activeCourseId,
  persist = false,
  variant = "dark",
  onChange,
}: CoursePickerProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (options.length <= 1) return null;

  const handleChange = async (next: string) => {
    if (next === activeCourseId) return;
    setError(null);

    if (!persist) {
      onChange(next);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/student/active-course", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, courseId: next }),
      });
      if (!res.ok) {
        setError("Could not switch course. Please try again.");
        return;
      }
      onChange(next);
    } catch {
      setError("Could not switch course. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const isLight = variant === "light";

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <label
        className={`text-xs font-semibold uppercase tracking-wide ${
          isLight ? "text-[#2B4257]/60" : "text-white/60"
        }`}
      >
        Course
      </label>
      <select
        value={activeCourseId ?? ""}
        disabled={saving}
        onChange={(e) => handleChange(e.target.value)}
        className={`min-h-11 md:min-h-0 px-3 py-1.5 rounded-lg text-sm font-medium border focus:outline-none focus:ring-2 disabled:opacity-50 transition-colors ${
          isLight
            ? "bg-white text-[#2B4257] border-[#2B4257]/20 hover:bg-[#2B4257]/5 focus:ring-[#65CFAD]/50"
            : "bg-white/10 text-white border-white/20 hover:bg-white/15 focus:ring-[#B1E7D6]/50"
        }`}
      >
        {options.map((opt) => (
          <option
            key={opt.course_id}
            value={opt.course_id}
            className={isLight ? "text-[#2B4257]" : "bg-[#1F2E3B] text-white"}
          >
            {opt.course_title}
          </option>
        ))}
      </select>
      {error && (
        <span
          className={`text-xs ${isLight ? "text-red-600" : "text-red-300"}`}
        >
          {error}
        </span>
      )}
    </div>
  );
}
