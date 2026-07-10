"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { EventInput } from "@fullcalendar/core";

import StudentListItem from "./_components/StudentListItem";
import { useDocumentTitle } from "@/src/hooks/useDocumentTitle";
import EmptyDetail from "../_components/EmptyDetail";
import ScheduleCalendar from "@/src/components/common/calendar/ScheduleCalendar";
import { sessionEvent } from "@/src/components/common/calendar/eventKinds";
import { fullName } from "@/src/utils/formatName";
import Pagination from "@/src/components/common/Pagination";
import StudentDetailModal from "./_components/StudentDetailModal";
import type { Student } from "../_types";
import { useAdminMobileDetail } from "../_context/AdminMobileDetailContext";

const ITEMS_PER_PAGE = 15;

/* Header + info cards + padding above the calendar eat ~340px. */
const CALENDAR_HEIGHT = "calc(100vh - 340px)";

const inputClass =
  "w-full bg-[#1F2E3B] border border-white/8 text-white placeholder:text-white/25 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#B1E7D6]/40 transition-colors";

type SessionRow = {
  id: number;
  start_time: string | null;
  end_time: string | null;
  coaches: { first_name: string | null; last_name: string | null } | null;
};

export default function StudentsPage() {
  useDocumentTitle("Students");
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedStudentId = searchParams.get("id");
  const { setHasDetail } = useAdminMobileDetail();

  const [students, setStudents] = useState<Student[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [studentSearch, setStudentSearch] = useState("");
  const [studentPage, setStudentPage] = useState(1);
  const [editingStudent, setEditingStudent] = useState(false);
  const [studentEvents, setStudentEvents] = useState<EventInput[]>([]);
  const [studentEventsLoading, setStudentEventsLoading] = useState(false);

  useEffect(() => {
    async function fetchStudents() {
      try {
        setStudentsLoading(true);
        const res = await fetch("/api/admin/students");
        if (!res.ok) throw new Error();
        const data = await res.json();
        setStudents(
          Array.isArray(data?.students)
            ? data.students.map((s: any) => ({
                id: String(s.id),
                account_id: String(s.account_id),
                first_name: s.first_name ?? null,
                last_name: s.last_name ?? null,
                avatar_url: s.avatar_url ?? null,
                bio: s.bio ?? null,
                created_at: s.created_at ?? "",
                updated_at: s.updated_at ?? "",
                date_of_birth: s.date_of_birth ?? null,
                grade: s.grade ?? null,
                lesson_space_id: s.lesson_space_id ?? null,
                lesson_space_student_link: s.lesson_space_student_link ?? null,
                lesson_space_teacher_link: s.lesson_space_teacher_link ?? null,
                location: s.location ?? null,
                notes: s.notes ?? null,
                post_lesson_days: s.post_lesson_days ?? null,
                post_lesson_tasks_enabled: s.post_lesson_tasks_enabled ?? null,
                webhook_room_id: s.webhook_room_id ?? null,
              }))
            : [],
        );
      } finally {
        setStudentsLoading(false);
      }
    }
    fetchStudents();
  }, []);

  const selectedStudent = useMemo(
    () => students.find((s) => s.id === selectedStudentId) ?? null,
    [students, selectedStudentId],
  );

  useEffect(() => {
    setHasDetail(!!selectedStudentId);
    return () => setHasDetail(false);
  }, [selectedStudentId, setHasDetail]);

  useEffect(() => {
    if (!selectedStudent) {
      setStudentEvents([]);
      return;
    }
    const studentId = selectedStudent.id;
    setStudentEventsLoading(true);

    // Stale-response guard: rapid student switching must not flash old events.
    let cancelled = false;
    async function loadStudentEvents() {
      try {
        const res = await fetch(`/api/admin/students/${studentId}/sessions`);
        const sessions: SessionRow[] = res.ok
          ? ((await res.json()).sessions ?? [])
          : [];
        if (cancelled) return;

        const events: EventInput[] = sessions
          .filter((s) => s.start_time)
          .map((s) =>
            sessionEvent({
              id: String(s.id),
              title: fullName(
                s.coaches?.first_name,
                s.coaches?.last_name,
                "Session",
              ),
              start: s.start_time!,
              end: s.end_time,
            }),
          );
        setStudentEvents(events);
      } catch {
        // fetch() rejects on network errors; res.json() throws on non-JSON
        // bodies (e.g. an auth redirect to /login). Fall back to empty.
        if (!cancelled) setStudentEvents([]);
      } finally {
        if (!cancelled) setStudentEventsLoading(false);
      }
    }
    loadStudentEvents();

    return () => {
      cancelled = true;
    };
  }, [selectedStudent?.id]);

  useEffect(() => {
    setStudentPage(1);
  }, [studentSearch]);

  const filteredStudents = useMemo(() => {
    if (!studentSearch.trim()) return students;
    const q = studentSearch.toLowerCase();
    return students.filter(
      (s) =>
        (s.first_name ?? "").toLowerCase().includes(q) ||
        (s.last_name ?? "").toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q) ||
        s.account_id.toLowerCase().includes(q) ||
        (s.grade ?? "").toLowerCase().includes(q) ||
        (s.location ?? "").toLowerCase().includes(q),
    );
  }, [students, studentSearch]);

  const totalPages = Math.ceil(filteredStudents.length / ITEMS_PER_PAGE);
  const paginatedStudents = useMemo(
    () =>
      filteredStudents.slice(
        (studentPage - 1) * ITEMS_PER_PAGE,
        studentPage * ITEMS_PER_PAGE,
      ),
    [filteredStudents, studentPage],
  );

  if (studentsLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-7 h-7 border-2 border-[#B1E7D6] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 min-w-0 overflow-hidden">
      {/* List panel */}
      <div
        className={`shrink-0 w-full md:w-72 lg:w-80 xl:w-[340px] bg-[#162330] border-r border-white/5 flex flex-col overflow-hidden
          ${selectedStudentId ? "hidden md:flex" : "flex"}`}
      >
        <div className="p-3 border-b border-white/5 flex gap-2 shrink-0">
          <input
            type="text"
            placeholder="Search students…"
            value={studentSearch}
            onChange={(e) => setStudentSearch(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {paginatedStudents.length === 0 ? (
            <p className="text-white/25 text-sm text-center py-12">
              No students found
            </p>
          ) : (
            paginatedStudents.map((s) => (
              <StudentListItem
                key={s.id}
                student={s}
                isSelected={selectedStudentId === s.id}
                onClick={() => router.push(`?id=${s.id}`)}
              />
            ))
          )}
        </div>
        <div className="shrink-0 border-t border-white/5 px-3 py-2">
          <Pagination
            currentPage={studentPage}
            totalPages={totalPages}
            totalItems={filteredStudents.length}
            itemsPerPage={ITEMS_PER_PAGE}
            onPageChange={setStudentPage}
          />
        </div>
      </div>

      {/* Detail panel */}
      <div
        className={`flex-1 min-w-0 overflow-y-auto
          ${!selectedStudentId ? "hidden md:flex md:flex-col" : "flex flex-col"}`}
      >
        {!selectedStudent && <EmptyDetail />}
        {selectedStudent && (
          <div className="p-4 md:p-6 space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-[#B1E7D6]/20 flex items-center justify-center shrink-0">
                  <span className="text-[#B1E7D6] text-2xl font-bold">
                    {(
                      selectedStudent.first_name ??
                      selectedStudent.last_name ??
                      "#"
                    )
                      .charAt(0)
                      .toUpperCase()}
                  </span>
                </div>
                <div>
                  <h2 className="text-white text-xl font-bold leading-tight">
                    {[selectedStudent.first_name, selectedStudent.last_name]
                      .filter(Boolean)
                      .join(" ") || "Unknown"}
                  </h2>
                  <p className="text-white/35 text-xs mt-0.5 font-mono">
                    #{selectedStudent.id}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingStudent(true)}
                className="shrink-0 min-h-[44px] md:min-h-0 px-3.5 py-1.5 text-xs font-semibold text-[#1F2E3B] bg-[#B1E7D6] hover:bg-[#9ed4c1] rounded-xl transition-colors"
              >
                Edit
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: "Grade", value: selectedStudent.grade ?? "—" },
                { label: "Location", value: selectedStudent.location ?? "—" },
                {
                  label: "Date of Birth",
                  value: selectedStudent.date_of_birth ?? "—",
                },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="bg-[#1F2E3B] rounded-xl p-3 border border-white/5"
                >
                  <p className="text-white/35 text-[10px] uppercase tracking-wider mb-1">
                    {label}
                  </p>
                  <p className="text-white/70 text-sm font-semibold truncate">
                    {value}
                  </p>
                </div>
              ))}
            </div>

            <div className="bg-[#1F2E3B] rounded-2xl p-4 border border-white/5">
              <ScheduleCalendar
                events={studentEvents}
                initialView="dayGridMonth"
                loading={studentEventsLoading}
                height={CALENDAR_HEIGHT}
              />
            </div>
          </div>
        )}
      </div>

      {editingStudent && selectedStudent && (
        <StudentDetailModal
          student={selectedStudent}
          onClose={() => setEditingStudent(false)}
          onUpdate={(updated) => {
            setStudents((prev) =>
              prev.map((s) => (s.id === updated.id ? updated : s)),
            );
            setEditingStudent(false);
          }}
        />
      )}
    </div>
  );
}
