"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import CourseListItem from "./_components/CourseListItem";
import { useDocumentTitle } from "@/src/hooks/useDocumentTitle";
import Avatar from "../_components/Avatar";
import EmptyDetail from "../_components/EmptyDetail";
import Pagination from "@/src/components/common/Pagination";
import CourseDetailModal from "./_components/CourseDetailModal";
import CreateCourseModal from "./_components/CreateCourseModal";
import CourseLessonsPanel from "./_components/CourseLessonPanel";
import type { Course } from "@/src/lib/lessons/types";
import { api, apiFetch } from "@/src/lib/api/routes";
import type { Student } from "../_types";
import { useAdminMobileDetail } from "../_context/AdminMobileDetailContext";

const ITEMS_PER_PAGE = 15;

const inputClass =
  "w-full bg-[#1F2E3B] border border-white/8 text-white placeholder:text-white/25 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#B1E7D6]/40 transition-colors";

export default function CoursesPage() {
  useDocumentTitle("Courses");
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedCourseId = searchParams.get("id");
  const { setHasDetail } = useAdminMobileDetail();

  const [courses, setCourses] = useState<Course[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [courseSearch, setCourseSearch] = useState("");
  const [coursePage, setCoursePage] = useState(1);
  const [editingCourse, setEditingCourse] = useState(false);
  const [isCreateCourseModalOpen, setIsCreateCourseModalOpen] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);

  useEffect(() => {
    async function fetchCourses() {
      try {
        setCoursesLoading(true);
        const res = await apiFetch(api.courses.list());
        if (!res.ok) throw new Error();
        const data = await res.json();
        const list = Array.isArray(data?.courses) ? data.courses : [];
        setCourses(
          list.map((c: any) => ({
            id: c.id,
            name: c.title,
            description: c.description,
          })),
        );
      } finally {
        setCoursesLoading(false);
      }
    }
    fetchCourses();

    apiFetch(api.students.list())
      .then((r) => r.json())
      .then((data) =>
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
        ),
      )
      .catch(() => {});
  }, []);

  const selectedCourse = useMemo(
    () => courses.find((c) => String(c.id) === selectedCourseId) ?? null,
    [courses, selectedCourseId],
  );

  useEffect(() => {
    setHasDetail(!!selectedCourseId);
    return () => setHasDetail(false);
  }, [selectedCourseId, setHasDetail]);

  useEffect(() => {
    setCoursePage(1);
  }, [courseSearch]);

  const filteredCourses = useMemo(() => {
    if (!courseSearch.trim()) return courses;
    const q = courseSearch.toLowerCase();
    return courses.filter(
      (c) => c.name.toLowerCase().includes(q) || c.id.toString().includes(q),
    );
  }, [courses, courseSearch]);

  const totalPages = Math.ceil(filteredCourses.length / ITEMS_PER_PAGE);
  const paginatedCourses = useMemo(
    () =>
      filteredCourses.slice(
        (coursePage - 1) * ITEMS_PER_PAGE,
        coursePage * ITEMS_PER_PAGE,
      ),
    [filteredCourses, coursePage],
  );

  if (coursesLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-7 h-7 border-2 border-blue-300 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 min-w-0 overflow-hidden">
      {/* List panel */}
      <div
        className={`shrink-0 w-full md:w-72 lg:w-80 xl:w-[340px] bg-[#162330] border-r border-white/5 flex flex-col overflow-hidden
          ${selectedCourseId ? "hidden md:flex" : "flex"}`}
      >
        <div className="p-3 border-b border-white/5 flex gap-2 shrink-0">
          <input
            type="text"
            placeholder="Search courses…"
            value={courseSearch}
            onChange={(e) => setCourseSearch(e.target.value)}
            className={inputClass}
          />
          <button
            onClick={() => setIsCreateCourseModalOpen(true)}
            title="New Course"
            className="shrink-0 w-10 h-10 bg-[#B1E7D6] text-[#1F2E3B] rounded-xl flex items-center justify-center font-bold text-lg hover:bg-[#9ed4c1] transition-colors"
          >
            +
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {paginatedCourses.length === 0 ? (
            <p className="text-white/25 text-sm text-center py-12">
              No courses found
            </p>
          ) : (
            paginatedCourses.map((c) => (
              <CourseListItem
                key={c.id}
                course={c}
                isSelected={String(c.id) === selectedCourseId}
                onClick={() => router.push(`?id=${c.id}`)}
              />
            ))
          )}
        </div>
        <div className="shrink-0 border-t border-white/5 px-3 py-2">
          <Pagination
            currentPage={coursePage}
            totalPages={totalPages}
            totalItems={filteredCourses.length}
            itemsPerPage={ITEMS_PER_PAGE}
            onPageChange={setCoursePage}
          />
        </div>
      </div>

      {/* Detail panel */}
      <div
        className={`flex-1 min-w-0 overflow-y-auto
          ${!selectedCourseId ? "hidden md:flex md:flex-col" : "flex flex-col"}`}
      >
        {!selectedCourse && <EmptyDetail />}
        {selectedCourse && (
          <div className="p-4 md:p-6 space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <Avatar
                  letter={selectedCourse.name.charAt(0) || "C"}
                  color="text-blue-300"
                  bg="bg-blue-400/15"
                />
                <div>
                  <h2 className="text-white text-xl font-bold leading-tight">
                    {selectedCourse.name}
                  </h2>
                  <p className="text-white/35 text-xs mt-0.5">
                    Course #{selectedCourse.id}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingCourse(true)}
                className="shrink-0 min-h-[44px] md:min-h-0 px-3.5 py-1.5 text-xs font-semibold text-white/70 bg-white/10 hover:bg-white/15 rounded-xl transition-colors"
              >
                Edit
              </button>
            </div>

            {selectedCourse.description && (
              <div className="bg-[#1F2E3B] rounded-xl p-4 border border-white/5">
                <p className="text-white/50 text-sm leading-relaxed">
                  {selectedCourse.description}
                </p>
              </div>
            )}

            <div className="bg-[#1F2E3B] rounded-2xl p-4 border border-white/5">
              <CourseLessonsPanel
                courseId={String(selectedCourse.id)}
                students={students}
              />
            </div>
          </div>
        )}
      </div>

      {editingCourse && selectedCourse && (
        <CourseDetailModal
          course={selectedCourse}
          students={students}
          onClose={() => setEditingCourse(false)}
          onUpdate={(updated) => {
            setCourses((prev) =>
              prev.map((c) => (c.id === updated.id ? updated : c)),
            );
            setEditingCourse(false);
          }}
          onDelete={() => {
            setCourses((prev) =>
              prev.filter((c) => c.id !== selectedCourse.id),
            );
            router.push("/admin/courses");
            setEditingCourse(false);
          }}
        />
      )}
      <CreateCourseModal
        isOpen={isCreateCourseModalOpen}
        onClose={() => setIsCreateCourseModalOpen(false)}
        onSuccess={() => {}}
      />
    </div>
  );
}
