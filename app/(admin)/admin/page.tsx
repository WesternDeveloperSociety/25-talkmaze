"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  TeachworksStudent,
  TeachworksEmployee,
  TeachworksCourse,
} from "@/lib/teachworks/types";
import StudentTable, { Student } from "./components/StudentTable";
import EmployeeTable from "./components/EmployeeTable";
import CreateAdminModal from "./components/CreateAdminModal";
import CreateCoachModal from "./components/CreateCoachModal";
import CourseTable from "./components/CourseTable";
import CreateCourseModal from "./components/CreateCourseModal";
import CourseLessonsPanel from "./components/CourseLessonPanel";
import { Assignment } from "@/lib/types/assignments";
import CoachAssignmentCard from "./components/CoachAssignmentCard";
import AssignStudentDropDown, {
  Coach,
} from "./components/AssignStudentDropDown";
const ITEMS_PER_PAGE = 5;

type TabType =
  | "students"
  | "coaches"
  | "courses"
  | "assignments"
  | "learning_space"
  | "course_assignment";

export default function AdminPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>("students");
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

  // Student state
  const [students, setStudents] = useState<Student[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [studentsError, setStudentsError] = useState<string | null>(null);
  const [studentSearchQuery, setStudentSearchQuery] = useState("");
  const [studentCurrentPage, setStudentCurrentPage] = useState(1);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  // editing student
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Student>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Employee state
  const [employees, setEmployees] = useState<Coach[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(true);
  const [employeesError, setEmployeesError] = useState<string | null>(null);
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState("");
  const [employeeCurrentPage, setEmployeeCurrentPage] = useState(1);
  const [selectedEmployee, setSelectedEmployee] = useState<Coach | null>(null);

  // editing employee
  const [isEditingEmployee, setIsEditingEmployee] = useState(false);
  const [employeeEditForm, setEmployeeEditForm] = useState<Partial<Coach>>({});
  const [isSavingEmployee, setIsSavingEmployee] = useState(false);
  const [coachAvailability, setCoachAvailability] = useState<
    Record<string, { start: string; end: string }[]>
  >({});
  const [originalAvailability, setOriginalAvailability] = useState<
    Record<string, { start: string; end: string }[]>
  >({});
  const DAY_MAP: Record<number, string> = {
    0: "Sunday",
    1: "Monday",
    2: "Tuesday",
    3: "Wednesday",
    4: "Thursday",
    5: "Friday",
    6: "Saturday",
  };
  const DAY_MAP_REVERSE: Record<string, number> = {
    Sunday: 0,
    Monday: 1,
    Tuesday: 2,
    Wednesday: 3,
    Thursday: 4,
    Friday: 5,
    Saturday: 6,
  };

  // Modal state
  const [isCreateAdminModalOpen, setIsCreateAdminModalOpen] = useState(false);
  const [isCreateCoachModalOpen, setIsCreateCoachModalOpen] = useState(false);

  // Course state
  const [courses, setCourses] = useState<TeachworksCourse[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [coursesError, setCoursesError] = useState<string | null>(null);
  const [courseSearchQuery, setCourseSearchQuery] = useState("");
  const [courseCurrentPage, setCourseCurrentPage] = useState(1);
  const [selectedCourse, setSelectedCourse] = useState<TeachworksCourse | null>(
    null,
  );
  const [isEditingCourse, setIsEditingCourse] = useState(false);
  const [courseEditForm, setCourseEditForm] = useState<
    Partial<TeachworksCourse>
  >({});
  const [isSavingCourse, setIsSavingCourse] = useState(false);
  const [isDeletingCourse, setIsDeletingCourse] = useState(false);
  const [isCreateCourseModalOpen, setIsCreateCourseModalOpen] = useState(false);

  // Assignment state
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(true);

  const handleAddAssignment = async (coachId: string, studentId: string) => {
    const res = await fetch("/api/admin/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ coach_id: coachId, student_id: studentId }),
    });
    if (!res.ok) {
      alert("Failed to add assignment");
      return;
    }
    const newAssignment = await res.json();
    setAssignments((prev) => [...prev, newAssignment]);
  };

  const handleRemoveAssignment = async (assignmentId: string) => {
    setAssignments((prev) => prev.filter((a) => a.id !== assignmentId));
    const res = await fetch(`/api/admin/assignments/${assignmentId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      alert("Failed to remove assignment");
      fetch("/api/admin/assignments")
        .then((r) => r.json())
        .then(setAssignments);
    }
  };

  useEffect(() => {
    fetch("/api/admin/assignments")
      .then((r) => r.json())
      .then((data) => setAssignments(Array.isArray(data) ? data : []))
      .catch(() => setAssignments([]))
      .finally(() => setAssignmentsLoading(false));
  }, []);

  useEffect(() => {
    async function fetchCourses() {
      try {
        setCoursesLoading(true);
        const response = await fetch("/api/admin/courses");
        if (!response.ok) throw new Error("Failed to fetch courses");
        const data = await response.json();
        const mapped = data.map((c: any) => ({
          id: c.id,
          name: c.title,
          description: c.description,
        }));
        setCourses(mapped);
      } catch (err) {
        setCoursesError(
          err instanceof Error ? err.message : "An error occurred",
        );
      } finally {
        setCoursesLoading(false);
      }
    }
    fetchCourses();
  }, []);

  useEffect(() => {
    setCourseCurrentPage(1);
  }, [courseSearchQuery]);

  const filteredCourses = useMemo(() => {
    if (!courseSearchQuery.trim()) return courses;
    const query = courseSearchQuery.toLowerCase();
    return courses.filter(
      (c) =>
        c.name.toLowerCase().includes(query) || c.id.toString().includes(query),
    );
  }, [courses, courseSearchQuery]);

  const courseTotalPages = Math.ceil(filteredCourses.length / ITEMS_PER_PAGE);
  const paginatedCourses = useMemo(() => {
    const start = (courseCurrentPage - 1) * ITEMS_PER_PAGE;
    return filteredCourses.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredCourses, courseCurrentPage]);

  const handleCloseCourseModal = () => {
    setSelectedCourse(null);
    setIsEditingCourse(false);
    setCourseEditForm({});
  };
  const handleEditCourseStart = () => {
    setCourseEditForm({ ...selectedCourse });
    setIsEditingCourse(true);
  };
  const handleEditCourseCancel = () => {
    setCourseEditForm({});
    setIsEditingCourse(false);
  };
  const handleEditCourseSave = async () => {
    if (!selectedCourse) return;
    setIsSavingCourse(true);
    try {
      const response = await fetch(`/api/admin/courses/${selectedCourse.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ course: courseEditForm }),
      });
      if (!response.ok) throw new Error("Failed to update course");
      const updated = await response.json();
      setCourses((prev) =>
        prev.map((c) => (c.id === updated.id ? updated : c)),
      );
      setSelectedCourse(updated);
      setIsEditingCourse(false);
      setCourseEditForm({});
    } catch (err) {
      alert(err instanceof Error ? err.message : "Save failed");
    } finally {
      setIsSavingCourse(false);
    }
  };
  const handleDeleteCourse = async () => {
    if (
      !selectedCourse ||
      !confirm(`Delete "${selectedCourse.name}"? This cannot be undone.`)
    )
      return;
    setIsDeletingCourse(true);
    try {
      const response = await fetch(`/api/admin/courses/${selectedCourse.id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete course");
      setCourses((prev) => prev.filter((c) => c.id !== selectedCourse.id));
      handleCloseCourseModal();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setIsDeletingCourse(false);
    }
  };

  // Check admin role
  useEffect(() => {
    async function checkAdminRole() {
      try {
        const response = await fetch("/api/user/role");
        if (!response.ok) throw new Error("Failed to fetch user role");
        const data = await response.json();
        if (data.role !== 3) {
          router.push("/home");
        } else {
          setIsAuthorized(true);
        }
      } catch (error) {
        console.error("Error checking admin role:", error);
        router.push("/home");
      }
    }
    checkAdminRole();
  }, [router]);

  // Fetch students
  useEffect(() => {
    async function fetchStudents() {
      try {
        setStudentsLoading(true);
        const response = await fetch("/api/admin/students");
        if (!response.ok) throw new Error("Failed to fetch students");

        const data = await response.json();

        const mapped: Student[] = Array.isArray(data)
          ? data.map((s: any) => ({
              id: String(s.id),
              account_id: String(s.account_id),
              name: s.name ?? "",
              created_at: s.created_at ?? "",
              updated_at: s.updated_at ?? "",
              lesson_space_id: s.lesson_space_id ?? null,
              profile_access_pin: s.profile_access_pin ?? null,
              teach_works_url: s.teach_works_url ?? null,
              lesson_space_teacher_link: s.lesson_space_teacher_link ?? null,
              lesson_space_student_link: s.lesson_space_student_link ?? null,
              remaining_lessons: s.remaining_lessons ?? null,
            }))
          : [];

        setStudents(mapped);
      } catch (err) {
        setStudentsError(
          err instanceof Error ? err.message : "An error occurred",
        );
      } finally {
        setStudentsLoading(false);
      }
    }

    fetchStudents();
  }, []);

  // Fetch employees
  const fetchEmployees = async () => {
    try {
      setEmployeesLoading(true);
      const response = await fetch("/api/admin/employees");
      if (!response.ok) throw new Error("Failed to fetch employees");
      const data = await response.json();
      setEmployees(data);
    } catch (err) {
      setEmployeesError(
        err instanceof Error ? err.message : "An error occurred",
      );
    } finally {
      setEmployeesLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const filteredStudents = useMemo(() => {
    if (!studentSearchQuery.trim()) return students;

    const query = studentSearchQuery.toLowerCase();

    return students.filter((student) => {
      return (
        student.name.toLowerCase().includes(query) ||
        student.id.toLowerCase().includes(query) ||
        student.account_id.toLowerCase().includes(query) ||
        (student.profile_access_pin ?? "").toLowerCase().includes(query)
      );
    });
  }, [students, studentSearchQuery]);

  const handleEditStart = () => {
    setEditForm({ ...selectedStudent });
    setIsEditing(true);
  };
  const handleEditCancel = () => {
    setEditForm({});
    setIsEditing(false);
  };
  const handleEditSave = async () => {
    if (!selectedStudent) return;
    setIsSaving(true);
    try {
      const response = await fetch(
        `/api/admin/students/${selectedStudent.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ student: editForm }),
        },
      );
      if (!response.ok) throw new Error("Failed to update student");
      const updated = await response.json();
      setStudents((prev) =>
        prev.map((s) => (s.id === updated.id ? updated : s)),
      );
      setSelectedStudent(updated);
      setIsEditing(false);
      setEditForm({});
    } catch (err) {
      alert(err instanceof Error ? err.message : "Save failed");
    } finally {
      setIsSaving(false);
    }
  };

  const filteredEmployees = useMemo(() => {
    if (!employeeSearchQuery.trim()) return employees;

    const query = employeeSearchQuery.toLowerCase();

    return employees.filter((coach) => {
      return (
        coach.name.toLowerCase().includes(query) ||
        coach.id.toLowerCase().includes(query) ||
        coach.account_id.toLowerCase().includes(query)
      );
    });
  }, [employees, employeeSearchQuery]);

  useEffect(() => {
    setStudentCurrentPage(1);
  }, [studentSearchQuery]);
  useEffect(() => {
    setEmployeeCurrentPage(1);
  }, [employeeSearchQuery]);

  const handleCloseStudentModal = () => {
    setSelectedStudent(null);
    setIsEditing(false);
    setEditForm({});
  };
  const handleCloseEmployeeModal = () => {
    setSelectedEmployee(null);
    setIsEditingEmployee(false);
    setEmployeeEditForm({});
  };
  const handleEditEmployeeStart = () => {
    setEmployeeEditForm({ ...selectedEmployee });
    setIsEditingEmployee(true);
  };
  const handleEditEmployeeCancel = () => {
    setEmployeeEditForm({});
    setIsEditingEmployee(false);
  };
  const handleEditEmployeeSave = async () => {
    if (!selectedEmployee) return;
    setIsSavingEmployee(true);
    try {
      const response = await fetch(
        `/api/admin/employees/${selectedEmployee.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ employee: employeeEditForm }),
        },
      );
      if (!response.ok) throw new Error("Failed to update employee");
      const updated = await response.json();
      setEmployees((prev) =>
        prev.map((e) => (e.id === updated.id ? updated : e)),
      );
      setSelectedEmployee(updated);
      setIsEditingEmployee(false);
      setEmployeeEditForm({});
    } catch (err) {
      alert(err instanceof Error ? err.message : "Save failed");
    } finally {
      setIsSavingEmployee(false);
    }
  };
  useEffect(() => {
    if (!selectedEmployee) {
      setCoachAvailability({});
      setOriginalAvailability({});
      return;
    }
    async function fetchCoachAvailability() {
      const res = await fetch(
        `/api/admin/employees/${selectedEmployee!.id}/availability`,
      );
      if (!res.ok) return;
      const rows: { weekday: number; start_time: string; end_time: string }[] =
        await res.json();
      const mapped: Record<string, { start: string; end: string }[]> = {};
      rows.forEach(({ weekday, start_time, end_time }) => {
        const day = DAY_MAP[weekday];
        const start = start_time.slice(11, 16);
        const end = end_time.slice(11, 16);
        if (!mapped[day]) mapped[day] = [];
        mapped[day].push({ start, end });
      });
      setCoachAvailability(mapped);
      setOriginalAvailability(mapped);
    }
    fetchCoachAvailability();
  }, [selectedEmployee]);

  const handleSaveCoachAvailability = async () => {
    if (!selectedEmployee) return;
    const res = await fetch(
      `/api/admin/employees/${selectedEmployee.id}/availability`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ availability: coachAvailability }),
      },
    );
    if (!res.ok) {
      alert("Failed to save availability");
      return;
    }
    setOriginalAvailability(coachAvailability);
    alert("Availability saved!");
  };
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (selectedStudent) handleCloseStudentModal();
        if (selectedEmployee) handleCloseEmployeeModal();
        if (selectedCourse) handleCloseCourseModal();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [selectedStudent, selectedEmployee, selectedCourse]);

  const studentTotalPages = Math.ceil(filteredStudents.length / ITEMS_PER_PAGE);
  const paginatedStudents = useMemo(() => {
    const startIndex = (studentCurrentPage - 1) * ITEMS_PER_PAGE;
    return filteredStudents.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredStudents, studentCurrentPage]);

  const employeeTotalPages = Math.ceil(
    filteredEmployees.length / ITEMS_PER_PAGE,
  );
  const paginatedEmployees = useMemo(() => {
    const startIndex = (employeeCurrentPage - 1) * ITEMS_PER_PAGE;
    return filteredEmployees.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredEmployees, employeeCurrentPage]);

  const loading =
    activeTab === "students"
      ? studentsLoading
      : activeTab === "coaches"
        ? employeesLoading
        : coursesLoading;
  const error =
    activeTab === "students"
      ? studentsError
      : activeTab === "coaches"
        ? employeesError
        : coursesError;

  if (isAuthorized === null) {
    return (
      <div className="p-4 max-w-md">
        <h1 className="text-base font-bold mb-2 text-gray-900">Admin</h1>
        <p className="text-sm text-gray-700">Verifying access...</p>
      </div>
    );
  }
  if (!isAuthorized) return null;
  if (loading) {
    return (
      <div className="p-4 max-w-md">
        <h1 className="text-base font-bold mb-2 text-gray-900">Admin</h1>
        <p className="text-sm text-gray-700">Loading...</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="p-4 max-w-md">
        <h1 className="text-base font-bold mb-2 text-gray-900">Admin</h1>
        <p className="text-sm text-red-600">Error: {error}</p>
      </div>
    );
  }

  const handleGetLessonSpaces = async () => {
    try {
      console.log("Inside handleGetLessonSpaces");
      const response = await fetch("/api/learningSpace");

      if (!response.ok) {
        console.log("Error with response");
      }

      await response.json();
      console.log("Response: " + JSON.stringify(response));
    } catch (err) {
      console.log("Error fetching lesson spaces");
    }
  };

  return (
    <div className="p-4 max-w-md">
      <div className="flex justify-between items-center mb-3">
        <h1 className="text-base font-bold text-gray-900">Admin</h1>
        <button
          onClick={() => setIsCreateAdminModalOpen(true)}
          className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors"
        >
          + Create Admin
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-3 border-b border-gray-200">
        <button
          onClick={() => setActiveTab("students")}
          className={`px-3 py-1.5 text-xs font-medium transition-colors ${
            activeTab === "students"
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Students
        </button>
        <button
          onClick={() => setActiveTab("coaches")}
          className={`px-3 py-1.5 text-xs font-medium transition-colors ${
            activeTab === "coaches"
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Coaches
        </button>
        <button
          onClick={() => setActiveTab("courses")}
          className={`px-3 py-1.5 text-xs font-medium transition-colors ${
            activeTab === "courses"
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Courses
        </button>
        <button
          onClick={() => setActiveTab("assignments")}
          className={`px-3 py-1.5 text-xs font-medium transition-colors ${
            activeTab === "assignments"
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Assignments
        </button>

        <button
          onClick={() => setActiveTab("learning_space")}
          className={`px-3 py-1.5 text-xs font-medium transition-colors ${
            activeTab === "learning_space"
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Learning Spaces
        </button>

        <button
          onClick={() => setActiveTab("course_assignment")}
          className={`px-3 py-1.5 text-xs font-medium transition-colors ${
            activeTab === "course_assignment"
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Course Assignment
        </button>
      </div>

      {/* ── Students Tab ── */}
      {activeTab === "students" && (
        <>
          <div className="mb-3">
            <input
              type="text"
              placeholder="Search by name, student ID, or customer ID..."
              value={studentSearchQuery}
              onChange={(e) => setStudentSearchQuery(e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent text-gray-900"
            />
          </div>
          <StudentTable
            students={paginatedStudents}
            onStudentClick={setSelectedStudent}
          />
          {studentTotalPages > 1 && (
            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs text-gray-600">
                Showing {(studentCurrentPage - 1) * ITEMS_PER_PAGE + 1} to{" "}
                {Math.min(
                  studentCurrentPage * ITEMS_PER_PAGE,
                  filteredStudents.length,
                )}{" "}
                of {filteredStudents.length}
              </p>
              <div className="flex gap-1.5">
                <button
                  onClick={() =>
                    setStudentCurrentPage((p) => Math.max(p - 1, 1))
                  }
                  disabled={studentCurrentPage === 1}
                  className="px-2 py-1 border border-gray-300 rounded text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Prev
                </button>
                <span className="px-2 py-1 text-xs text-gray-700">
                  {studentCurrentPage} / {studentTotalPages}
                </span>
                <button
                  onClick={() =>
                    setStudentCurrentPage((p) =>
                      Math.min(p + 1, studentTotalPages),
                    )
                  }
                  disabled={studentCurrentPage === studentTotalPages}
                  className="px-2 py-1 border border-gray-300 rounded text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
          {studentTotalPages <= 1 && filteredStudents.length > 0 && (
            <p className="mt-3 text-xs text-gray-600">
              Total: {filteredStudents.length}
            </p>
          )}
        </>
      )}

      {/* ── Coaches Tab ── */}
      {activeTab === "coaches" && (
        <>
          <div className="flex justify-between items-center mb-3">
            <input
              type="text"
              placeholder="Search by name, employee ID, or position..."
              value={employeeSearchQuery}
              onChange={(e) => setEmployeeSearchQuery(e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent text-gray-900 mr-3"
            />
            <button
              onClick={() => setIsCreateCoachModalOpen(true)}
              className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded transition-colors whitespace-nowrap"
            >
              + Create Coach
            </button>
          </div>
          <EmployeeTable
            employees={paginatedEmployees}
            onEmployeeClick={setSelectedEmployee}
          />
          {employeeTotalPages > 1 && (
            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs text-gray-600">
                Showing {(employeeCurrentPage - 1) * ITEMS_PER_PAGE + 1} to{" "}
                {Math.min(
                  employeeCurrentPage * ITEMS_PER_PAGE,
                  filteredEmployees.length,
                )}{" "}
                of {filteredEmployees.length}
              </p>
              <div className="flex gap-1.5">
                <button
                  onClick={() =>
                    setEmployeeCurrentPage((p) => Math.max(p - 1, 1))
                  }
                  disabled={employeeCurrentPage === 1}
                  className="px-2 py-1 border border-gray-300 rounded text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Prev
                </button>
                <span className="px-2 py-1 text-xs text-gray-700">
                  {employeeCurrentPage} / {employeeTotalPages}
                </span>
                <button
                  onClick={() =>
                    setEmployeeCurrentPage((p) =>
                      Math.min(p + 1, employeeTotalPages),
                    )
                  }
                  disabled={employeeCurrentPage === employeeTotalPages}
                  className="px-2 py-1 border border-gray-300 rounded text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
          {employeeTotalPages <= 1 && filteredEmployees.length > 0 && (
            <p className="mt-3 text-xs text-gray-600">
              Total: {filteredEmployees.length}
            </p>
          )}
        </>
      )}

      {/* ── Student Detail Modal ── */}
      {selectedStudent && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={handleCloseStudentModal}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <h2 className="text-lg font-bold text-gray-900">
                {isEditing
                  ? `${editForm.name ?? selectedStudent.name}`
                  : `${selectedStudent.name} `}
              </h2>
              <div className="flex items-center gap-2">
                {!isEditing ? (
                  <>
                    <button
                      onClick={handleEditStart}
                      className="px-3 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={handleCloseStudentModal}
                      className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                    >
                      ×
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={handleEditSave}
                      disabled={isSaving}
                      className="px-3 py-1 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded transition-colors disabled:opacity-50"
                    >
                      {isSaving ? "Saving..." : "Save"}
                    </button>
                    <button
                      onClick={handleEditCancel}
                      className="px-3 py-1 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                    >
                      Cancel
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="px-6 py-4 space-y-4">
              {(() => {
                const Field = ({
                  label,
                  fieldKey,
                  type = "text",
                }: {
                  label: string;
                  fieldKey: keyof Student;
                  type?: string;
                }) => (
                  <div>
                    <span className="text-gray-500">{label}:</span>
                    {isEditing ? (
                      <input
                        type={type}
                        value={(editForm[fieldKey] as string) ?? ""}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            [fieldKey]: e.target.value,
                          }))
                        }
                        className="mt-0.5 block w-full border border-gray-300 rounded px-2 py-1 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    ) : (
                      <p className="text-gray-900 font-medium">
                        {(selectedStudent[fieldKey] as string) || "N/A"}
                      </p>
                    )}
                  </div>
                );

                const SelectField = ({
                  label,
                  fieldKey,
                  options,
                }: {
                  label: string;
                  fieldKey: keyof Student;
                  options: string[];
                }) => (
                  <div>
                    <span className="text-gray-500">{label}:</span>
                    {isEditing ? (
                      <select
                        value={(editForm[fieldKey] as string) ?? ""}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            [fieldKey]: e.target.value,
                          }))
                        }
                        className="mt-0.5 block w-full border border-gray-300 rounded px-2 py-1 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        {options.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <p className="text-green-600">
                        {(selectedStudent[fieldKey] as string) || "N/A"}
                      </p>
                    )}
                  </div>
                );

                return (
                  <>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-2">
                        Basic Information
                      </h3>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <span className="text-gray-500">Student ID:</span>
                          <p className="text-gray-900 font-medium">
                            {selectedStudent.id}
                          </p>
                        </div>

                        <div>
                          <span className="text-gray-500">Account ID:</span>
                          <p className="text-gray-900 font-medium">
                            {selectedStudent.account_id}
                          </p>
                        </div>

                        <div>
                          <span className="text-gray-500">Name:</span>
                          {isEditing ? (
                            <input
                              type="text"
                              value={editForm.name ?? ""}
                              onChange={(e) =>
                                setEditForm((prev) => ({
                                  ...prev,
                                  name: e.target.value,
                                }))
                              }
                              className="mt-0.5 block w-full border border-gray-300 rounded px-2 py-1 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          ) : (
                            <p className="text-gray-900 font-medium">
                              {selectedStudent.name || "N/A"}
                            </p>
                          )}
                        </div>

                        <div>
                          <span className="text-gray-500">
                            Remaining Lessons:
                          </span>
                          {isEditing ? (
                            <input
                              type="number"
                              value={editForm.remaining_lessons ?? ""}
                              onChange={(e) =>
                                setEditForm((prev) => ({
                                  ...prev,
                                  remaining_lessons:
                                    e.target.value === ""
                                      ? null
                                      : Number(e.target.value),
                                }))
                              }
                              className="mt-0.5 block w-full border border-gray-300 rounded px-2 py-1 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          ) : (
                            <p className="text-gray-900 font-medium">
                              {selectedStudent.remaining_lessons ?? "N/A"}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-2">
                        Lesson Space Information
                      </h3>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <span className="text-gray-500">
                            Lesson Space ID:
                          </span>
                          <p className="text-gray-900 font-medium break-all">
                            {selectedStudent.lesson_space_id ?? "N/A"}
                          </p>
                        </div>

                        <div>
                          <span className="text-gray-500">
                            Profile Access PIN:
                          </span>
                          {isEditing ? (
                            <input
                              type="text"
                              value={editForm.profile_access_pin ?? ""}
                              onChange={(e) =>
                                setEditForm((prev) => ({
                                  ...prev,
                                  profile_access_pin: e.target.value,
                                }))
                              }
                              className="mt-0.5 block w-full border border-gray-300 rounded px-2 py-1 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          ) : (
                            <p className="text-gray-900 font-medium">
                              {selectedStudent.profile_access_pin ?? "N/A"}
                            </p>
                          )}
                        </div>

                        <div className="col-span-2">
                          <span className="text-gray-500">Student Link:</span>
                          {isEditing ? (
                            <input
                              type="text"
                              value={editForm.lesson_space_student_link ?? ""}
                              onChange={(e) =>
                                setEditForm((prev) => ({
                                  ...prev,
                                  lesson_space_student_link: e.target.value,
                                }))
                              }
                              className="mt-0.5 block w-full border border-gray-300 rounded px-2 py-1 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          ) : (
                            <p className="text-gray-900 font-medium break-all">
                              {selectedStudent.lesson_space_student_link ??
                                "N/A"}
                            </p>
                          )}
                        </div>

                        <div className="col-span-2">
                          <span className="text-gray-500">Teacher Link:</span>
                          {isEditing ? (
                            <input
                              type="text"
                              value={editForm.lesson_space_teacher_link ?? ""}
                              onChange={(e) =>
                                setEditForm((prev) => ({
                                  ...prev,
                                  lesson_space_teacher_link: e.target.value,
                                }))
                              }
                              className="mt-0.5 block w-full border border-gray-300 rounded px-2 py-1 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          ) : (
                            <p className="text-gray-900 font-medium break-all">
                              {selectedStudent.lesson_space_teacher_link ??
                                "N/A"}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-2">
                        Other Information
                      </h3>
                      <div className="grid grid-cols-1 gap-3 text-xs">
                        <div>
                          <span className="text-gray-500">Teachworks URL:</span>
                          {isEditing ? (
                            <input
                              type="text"
                              value={editForm.teach_works_url ?? ""}
                              onChange={(e) =>
                                setEditForm((prev) => ({
                                  ...prev,
                                  teach_works_url: e.target.value,
                                }))
                              }
                              className="mt-0.5 block w-full border border-gray-300 rounded px-2 py-1 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          ) : (
                            <p className="text-gray-900 font-medium break-all">
                              {selectedStudent.teach_works_url ?? "N/A"}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ── Employee Detail Modal ── */}
      {selectedEmployee && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={handleCloseEmployeeModal}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <h2 className="text-lg font-bold text-gray-900">
                {isEditingEmployee
                  ? `${employeeEditForm.name ?? selectedEmployee.name}`
                  : `${selectedEmployee.name}`}
              </h2>
              <div className="flex items-center gap-2">
                {!isEditingEmployee ? (
                  <>
                    <button
                      onClick={handleEditEmployeeStart}
                      className="px-3 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={handleCloseEmployeeModal}
                      className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                    >
                      x
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={handleEditEmployeeSave}
                      disabled={isSavingEmployee}
                      className="px-3 py-1 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded transition-colors disabled:opacity-50"
                    >
                      {isSavingEmployee ? "Saving..." : "Save"}
                    </button>
                    <button
                      onClick={handleEditEmployeeCancel}
                      className="px-3 py-1 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                    >
                      Cancel
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="px-6 py-4 space-y-4">
              {(() => {
                const Field = ({
                  label,
                  fieldKey,
                  type = "text",
                  colSpan = "",
                }: {
                  label: string;
                  fieldKey: keyof Coach;
                  type?: string;
                  colSpan?: string;
                }) => (
                  <div className={colSpan}>
                    <span className="text-gray-500">{label}:</span>
                    {isEditingEmployee ? (
                      <input
                        type={type}
                        value={(employeeEditForm[fieldKey] as string) ?? ""}
                        onChange={(e) =>
                          setEmployeeEditForm((prev) => ({
                            ...prev,
                            [fieldKey]: e.target.value,
                          }))
                        }
                        className="mt-0.5 block w-full border border-gray-300 rounded px-2 py-1 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    ) : (
                      <p className="text-gray-900 font-medium">
                        {(selectedEmployee[fieldKey] as string) || "N/A"}
                      </p>
                    )}
                  </div>
                );

                const SelectField = ({
                  label,
                  fieldKey,
                  options,
                  colorFn,
                }: {
                  label: string;
                  fieldKey: keyof Coach;
                  options: string[];
                  colorFn?: (val: string) => string;
                }) => (
                  <div>
                    <span className="text-gray-500">{label}:</span>
                    {isEditingEmployee ? (
                      <select
                        value={(employeeEditForm[fieldKey] as string) ?? ""}
                        onChange={(e) =>
                          setEmployeeEditForm((prev) => ({
                            ...prev,
                            [fieldKey]: e.target.value,
                          }))
                        }
                        className="mt-0.5 block w-full border border-gray-300 rounded px-2 py-1 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        {options.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <p
                        className={`font-medium capitalize ${
                          colorFn
                            ? colorFn(selectedEmployee[fieldKey] as string)
                            : "text-gray-900"
                        }`}
                      >
                        {(selectedEmployee[fieldKey] as string) || "N/A"}
                      </p>
                    )}
                  </div>
                );

                const TextArea = ({
                  label,
                  fieldKey,
                }: {
                  label: string;
                  fieldKey: keyof Coach;
                }) => (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">
                      {label}
                    </h3>
                    {isEditingEmployee ? (
                      <textarea
                        value={(employeeEditForm[fieldKey] as string) ?? ""}
                        onChange={(e) =>
                          setEmployeeEditForm((prev) => ({
                            ...prev,
                            [fieldKey]: e.target.value,
                          }))
                        }
                        rows={3}
                        className="block w-full border border-gray-300 rounded px-2 py-1 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    ) : (
                      <p className="text-xs text-gray-900">
                        {(selectedEmployee[fieldKey] as string) || "N/A"}
                      </p>
                    )}
                  </div>
                );

                return (
                  <>
                    {/* BASIC INFO */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-2">
                        Basic Information
                      </h3>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <span className="text-gray-500">Coach ID:</span>
                          <p className="text-gray-900 font-medium">
                            {selectedEmployee.id}
                          </p>
                        </div>

                        <div>
                          <span className="text-gray-500">Account ID:</span>
                          <p className="text-gray-900 font-medium">
                            {selectedEmployee.account_id}
                          </p>
                        </div>

                        <Field
                          label="Name"
                          fieldKey="name"
                          colSpan="col-span-2"
                        />
                      </div>
                    </div>

                    {/* TIMESTAMPS */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-2">
                        Timestamps
                      </h3>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <span className="text-gray-500">Created At:</span>
                          <p className="text-gray-900 font-medium">
                            {selectedEmployee.created_at || "N/A"}
                          </p>
                        </div>

                        <div>
                          <span className="text-gray-500">Updated At:</span>
                          <p className="text-gray-900 font-medium">
                            {selectedEmployee.updated_at || "N/A"}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* OPTIONAL EXTRA FIELDS EXAMPLE */}
                    {/* <SelectField label="Status" fieldKey="status" options={["active", "inactive"]} /> */}
                    {/* <TextArea label="Notes" fieldKey="notes" /> */}
                  </>
                );
              })()}

              {/* AVAILABILITY SECTION (unchanged) */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-sm font-semibold text-gray-700">
                    Weekly Availability
                  </h3>
                  <button
                    onClick={handleSaveCoachAvailability}
                    className="px-3 py-1 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded transition-colors"
                  >
                    Save Availability
                  </button>
                </div>

                {[
                  "Monday",
                  "Tuesday",
                  "Wednesday",
                  "Thursday",
                  "Friday",
                  "Saturday",
                  "Sunday",
                ].map((day) => {
                  const enabled = !!coachAvailability[day];
                  const slots = coachAvailability[day] || [];

                  return (
                    <div key={day} className="border rounded p-3 mb-2">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-semibold text-gray-700">
                          {day}
                        </span>

                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={enabled}
                            onChange={() => {
                              setCoachAvailability((prev) => {
                                const copy = { ...prev };
                                if (copy[day]) delete copy[day];
                                else copy[day] = [{ start: "", end: "" }];
                                return copy;
                              });
                            }}
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:bg-[#B1E7D6]" />
                          <div className="absolute left-1 top-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4" />
                        </label>
                      </div>

                      {enabled && (
                        <div className="flex flex-col gap-1 mt-1">
                          {slots.map((slot, idx) => (
                            <div key={idx} className="flex gap-2 items-center">
                              <input
                                type="time"
                                value={slot.start}
                                onChange={(e) =>
                                  setCoachAvailability((prev) => {
                                    const updated = [...prev[day]];
                                    updated[idx] = {
                                      ...updated[idx],
                                      start: e.target.value,
                                    };
                                    return { ...prev, [day]: updated };
                                  })
                                }
                                className="border rounded px-1 py-0.5 text-xs"
                              />

                              <span className="text-xs">–</span>

                              <input
                                type="time"
                                value={slot.end}
                                onChange={(e) =>
                                  setCoachAvailability((prev) => {
                                    const updated = [...prev[day]];
                                    updated[idx] = {
                                      ...updated[idx],
                                      end: e.target.value,
                                    };
                                    return { ...prev, [day]: updated };
                                  })
                                }
                                className="border rounded px-1 py-0.5 text-xs"
                              />

                              <button
                                type="button"
                                onClick={() =>
                                  setCoachAvailability((prev) => {
                                    const filtered = prev[day].filter(
                                      (_, i) => i !== idx,
                                    );
                                    const copy = { ...prev };
                                    if (filtered.length === 0) delete copy[day];
                                    else copy[day] = filtered;
                                    return copy;
                                  })
                                }
                                className="text-red-500 text-xs"
                              >
                                ✕
                              </button>
                            </div>
                          ))}

                          <button
                            type="button"
                            onClick={() =>
                              setCoachAvailability((prev) => ({
                                ...prev,
                                [day]: [...prev[day], { start: "", end: "" }],
                              }))
                            }
                            className="text-xs text-green-600 mt-1"
                          >
                            + Add time
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Courses Tab ── */}
      {activeTab === "courses" && (
        <>
          <div className="mb-3 flex gap-2">
            <input
              type="text"
              placeholder="Search by name or ID..."
              value={courseSearchQuery}
              onChange={(e) => setCourseSearchQuery(e.target.value)}
              className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent text-gray-900"
            />
            <button
              onClick={() => setIsCreateCourseModalOpen(true)}
              className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors whitespace-nowrap"
            >
              + New Course
            </button>
          </div>

          <CourseTable
            courses={paginatedCourses}
            onCourseClick={setSelectedCourse}
          />

          {courseTotalPages > 1 && (
            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs text-gray-600">
                Showing {(courseCurrentPage - 1) * ITEMS_PER_PAGE + 1} to{" "}
                {Math.min(
                  courseCurrentPage * ITEMS_PER_PAGE,
                  filteredCourses.length,
                )}{" "}
                of {filteredCourses.length}
              </p>
              <div className="flex gap-1.5">
                <button
                  onClick={() =>
                    setCourseCurrentPage((p) => Math.max(p - 1, 1))
                  }
                  disabled={courseCurrentPage === 1}
                  className="px-2 py-1 border border-gray-300 rounded text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Prev
                </button>
                <span className="px-2 py-1 text-xs text-gray-700">
                  {courseCurrentPage} / {courseTotalPages}
                </span>
                <button
                  onClick={() =>
                    setCourseCurrentPage((p) =>
                      Math.min(p + 1, courseTotalPages),
                    )
                  }
                  disabled={courseCurrentPage === courseTotalPages}
                  className="px-2 py-1 border border-gray-300 rounded text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
          {courseTotalPages <= 1 && filteredCourses.length > 0 && (
            <p className="mt-3 text-xs text-gray-600">
              Total: {filteredCourses.length}
            </p>
          )}
        </>
      )}

      {/* ── Assignments Tab ── */}
      {activeTab === "assignments" && (
        <div className="space-y-3">
          {filteredEmployees.map((coach) => {
            const coachAssignments = assignments.filter(
              (a) => a.coach_id === coach.id.toString(),
            );
            const assignedStudentIds = new Set(
              coachAssignments.map((a) => a.student_id),
            );
            const availableStudents = students.filter(
              (s) => !assignedStudentIds.has(s.id.toString()),
            );
            return (
              <CoachAssignmentCard
                key={coach.id}
                coach={coach}
                assignedStudents={coachAssignments}
                availableStudents={availableStudents}
                onAdd={(studentId) =>
                  handleAddAssignment(coach.id.toString(), studentId)
                }
                onRemove={(assignmentId) =>
                  handleRemoveAssignment(assignmentId)
                }
              />
            );
          })}
        </div>
      )}

      {activeTab == "learning_space" && (
        <div>
          <button onClick={handleGetLessonSpaces}>Get Learning Spaces</button>
        </div>
      )}

      {activeTab == "course_assignment" && <div></div>}
      {/* Course Detail Modal */}
      {selectedCourse && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={handleCloseCourseModal}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <h2 className="text-lg font-bold text-gray-900">
                {isEditingCourse
                  ? (courseEditForm.name ?? selectedCourse.name)
                  : selectedCourse.name}
              </h2>
              <div className="flex items-center gap-2">
                {!isEditingCourse ? (
                  <>
                    <button
                      onClick={handleDeleteCourse}
                      disabled={isDeletingCourse}
                      className="px-3 py-1 text-xs font-medium text-white bg-red-500 hover:bg-red-600 rounded transition-colors disabled:opacity-50"
                    >
                      {isDeletingCourse ? "Deleting..." : "Delete"}
                    </button>
                    <button
                      onClick={handleEditCourseStart}
                      className="px-3 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={handleCloseCourseModal}
                      className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                    >
                      ×
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={handleEditCourseSave}
                      disabled={isSavingCourse}
                      className="px-3 py-1 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded transition-colors disabled:opacity-50"
                    >
                      {isSavingCourse ? "Saving..." : "Save"}
                    </button>
                    <button
                      onClick={handleEditCourseCancel}
                      className="px-3 py-1 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                    >
                      Cancel
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="px-6 py-4 space-y-6 text-xs">
              {/* Course Info */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">
                  Course Information
                </h3>
                <div className="space-y-3">
                  <div>
                    <span className="text-gray-500">Course ID:</span>
                    <p className="text-gray-900 font-medium">
                      {selectedCourse.id}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">Name:</span>
                    {isEditingCourse ? (
                      <input
                        type="text"
                        value={courseEditForm.name ?? ""}
                        onChange={(e) =>
                          setCourseEditForm((prev) => ({
                            ...prev,
                            name: e.target.value,
                          }))
                        }
                        className="mt-0.5 block w-full border border-gray-300 rounded px-2 py-1 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    ) : (
                      <p className="text-gray-900 font-medium">
                        {selectedCourse.name}
                      </p>
                    )}
                  </div>
                  <div>
                    <span className="text-gray-500">Description:</span>
                    {isEditingCourse ? (
                      <textarea
                        value={courseEditForm.description ?? ""}
                        onChange={(e) =>
                          setCourseEditForm((prev) => ({
                            ...prev,
                            description: e.target.value,
                          }))
                        }
                        rows={4}
                        className="mt-0.5 block w-full border border-gray-300 rounded px-2 py-1 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    ) : (
                      <p className="text-gray-900">
                        {selectedCourse.description || "N/A"}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Divider */}
              <hr className="border-gray-100" />

              {/* ── Lessons Panel ── */}
              <CourseLessonsPanel
                students={students}
                courseId={String(selectedCourse.id)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Create Course Modal */}
      <CreateCourseModal
        isOpen={isCreateCourseModalOpen}
        onClose={() => setIsCreateCourseModalOpen(false)}
        onSuccess={(created) =>
          setCourses((prev) => [...prev, created as TeachworksCourse])
        }
      />

      {/* Create Admin Modal */}
      <CreateAdminModal
        isOpen={isCreateAdminModalOpen}
        onClose={() => setIsCreateAdminModalOpen(false)}
        onSuccess={() => {
          alert("Admin account created successfully!");
        }}
      />

      {/* Create Coach Modal */}
      <CreateCoachModal
        isOpen={isCreateCoachModalOpen}
        onClose={() => setIsCreateCoachModalOpen(false)}
        onSuccess={() => {
          alert("Coach created successfully");
          fetchEmployees();
        }}
      />
    </div>
  );
}
