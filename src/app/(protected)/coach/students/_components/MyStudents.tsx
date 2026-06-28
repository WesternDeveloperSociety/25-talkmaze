"use client";

import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import StudentListItem from "./students-list/StudentListItem";
import { SearchInput } from "@/src/components/ui/search-input";
import { fullName } from "@/src/utils/formatName";
import type { CoachStudent } from "../_lib/getCoachDashboardContext";

interface MyStudentsProps {
  students: CoachStudent[];
}

/**
 * The persistent "My Students" list: a transparent panel that sits on the dark
 * content container, filters in place, and scrolls (no pagination). Each row
 * links to the student's Overview; selection is URL-driven, so the active
 * student is read from the pathname (this list lives in a layout without the
 * [studentId] param) rather than passed in.
 */
export default function MyStudents({ students }: MyStudentsProps) {
  // /coach/students/<id>(/tab) -> <id>; /coach/students -> none selected.
  const pathname = usePathname();
  const activeStudentId =
    pathname.match(/^\/coach\/students\/([^/]+)/)?.[1] ?? null;
  const [search, setSearch] = useState("");

  const filteredStudents = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return students;
    return students.filter((student) =>
      fullName(student.first_name, student.last_name, "Unnamed Student")
        .toLowerCase()
        .includes(query),
    );
  }, [students, search]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between px-4 pt-4 pb-3">
        <h2 className="text-base font-semibold text-white">My Students</h2>
        <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-[#B1E7D6]">
          {search.trim()
            ? `${filteredStudents.length}/${students.length}`
            : students.length}
        </span>
      </div>

      <div className="shrink-0 px-4 pb-3">
        <SearchInput
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search students..."
          aria-label="Search students"
          variant="dark"
          className="h-10 rounded-[9px] border-gray-500 bg-transparent text-white placeholder:text-gray-400"
        />
      </div>

      {students.length === 0 ? (
        <div className="p-10 text-center text-sm text-white/40">
          No students assigned yet.
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="p-10 text-center text-sm text-white/40">
          No students match your search.
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-2">
          <ul className="space-y-1">
            {filteredStudents.map((student) => (
              <StudentListItem
                key={student.id}
                student={student}
                isActive={student.id === activeStudentId}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
