"use client";

import { useState, useRef, useEffect } from "react";
import { TeachworksEmployee, TeachworksStudent } from "@/lib/teachworks/types";
import { Assignment } from "@/lib/types/assignments";
import { Student,Coach } from "./AssignStudentDropDown";

interface CoachAssignmentCardProps {
  coach: Coach;
  assignedStudents: Assignment[];
  availableStudents: Student[];
  onAdd: (studentId: string) => Promise<void>;
  onRemove: (assignmentId: string) => Promise<void>;
}

export default function CoachAssignmentCard({
  coach,
  assignedStudents,
  availableStudents,
  onAdd,
  onRemove,
}: CoachAssignmentCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingStudentId, setLoadingStudentId] = useState<string | null>(null);
  const [removingAssignmentId, setRemovingAssignmentId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
        setSearchQuery("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isDropdownOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [isDropdownOpen]);

const filteredAvailable = availableStudents.filter((s) => {
  if (!searchQuery.trim()) return true;
  const q = searchQuery.toLowerCase();

  return (
    s.name.toLowerCase().includes(q) ||
    s.id.toLowerCase().includes(q) ||
    s.account_id.toLowerCase().includes(q) ||
    (s.profile_access_pin ?? "").toLowerCase().includes(q)
  );
});

  const handleAdd = async (studentId: string) => {
    setLoadingStudentId(studentId);
    setIsDropdownOpen(false);
    setSearchQuery("");
    try {
      await onAdd(studentId);
    } finally {
      setLoadingStudentId(null);
    }
  };

  const handleRemove = async (assignmentId: string) => {
    setRemovingAssignmentId(assignmentId);
    try {
      await onRemove(assignmentId);
    } finally {
      setRemovingAssignmentId(null);
    }
  };

  return (
    <div className="border border-gray-200 rounded bg-white shadow-sm">
      <button
        onClick={() => setIsExpanded((prev) => !prev)}
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          <svg
            className={`w-3.5 h-3.5 text-gray-400 flex-shrink-0 transition-transform duration-150 ${
              isExpanded ? "rotate-90" : ""
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>

          <span className="text-xs font-semibold text-gray-900 truncate">
            {coach.name}
          </span>
        </div>

        {/* Student count badge */}
        <span
          className={`flex-shrink-0 ml-2 px-1.5 py-0.5 rounded-full text-xs font-medium ${
            assignedStudents.length > 0
              ? "bg-blue-100 text-blue-700"
              : "bg-gray-100 text-gray-500"
          }`}
        >
          {assignedStudents.length} student{assignedStudents.length !== 1 ? "s" : ""}
        </span>
      </button>

      {/* Expanded body */}
      {isExpanded && (
        <div className="border-t border-gray-100 px-3 py-2 space-y-1.5">
          {/* Assigned students list */}
          {assignedStudents.length === 0 ? (
            <p className="text-xs text-gray-400 italic py-1">No students assigned</p>
          ) : (
            <ul className="space-y-1">
              {assignedStudents.map((assignment) => {
                const isRemoving = removingAssignmentId === assignment.id;
                // Derive student name: prefer joined data, fall back to student_id
                const studentName =
                  assignment.students && assignment.students.name
                    ? assignment.students.name
                    : `Student #${assignment.student_id}`;

                return (
                  <li
                    key={assignment.id}
                    className={`flex items-center justify-between gap-2 py-1 px-2 rounded transition-colors ${
                      isRemoving ? "opacity-40" : "hover:bg-gray-50"
                    }`}
                  >
                    <span className="text-xs text-gray-800 truncate">{studentName}</span>
                    <button
                      onClick={() => handleRemove(assignment.id)}
                      disabled={isRemoving}
                      title="Remove student"
                      className="flex-shrink-0 w-4 h-4 flex items-center justify-center rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:cursor-not-allowed"
                    >
                      {isRemoving ? (
                        <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                          <circle
                            className="opacity-25"
                            cx="12" cy="12" r="10"
                            stroke="currentColor" strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8v8H4z"
                          />
                        </svg>
                      ) : (
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Add student dropdown */}
          <div className="relative pt-1" ref={dropdownRef}>
            <button
              onClick={() => setIsDropdownOpen((prev) => !prev)}
              disabled={availableStudents.length === 0}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              {availableStudents.length === 0 ? "All students assigned" : "Add student"}
            </button>

            {isDropdownOpen && (
              <div className="absolute left-0 top-full mt-1 w-56 bg-white border border-gray-200 rounded shadow-lg z-20">
                {/* Search inside dropdown */}
                <div className="p-1.5 border-b border-gray-100">
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search students..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-900"
                  />
                </div>

                <ul className="max-h-40 overflow-y-auto py-1">
                  {filteredAvailable.length === 0 ? (
                    <li className="px-3 py-1.5 text-xs text-gray-400 italic">No matches</li>
                  ) : (
                    filteredAvailable.map((student) => {
                      const isAdding = loadingStudentId === student.id.toString();
                      return (
                        <li key={student.id}>
                          <button
                            onClick={() => handleAdd(student.id.toString())}
                            disabled={isAdding}
                            className="w-full text-left px-3 py-1.5 text-xs text-gray-800 hover:bg-blue-50 hover:text-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-between gap-2"
                          >
                            <span className="truncate">
                              {student.name}
                            </span>
                            {isAdding && (
                              <svg className="animate-spin w-3 h-3 flex-shrink-0 text-blue-500" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                              </svg>
                            )}
                          </button>
                        </li>
                      );
                    })
                  )}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}