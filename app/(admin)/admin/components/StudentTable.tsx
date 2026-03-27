"use client";

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

interface StudentTableProps {
  students?: Student[];
  onStudentClick: (student: Student) => void;
}

export default function StudentTable({
  students = [],
  onStudentClick,
}: StudentTableProps) {
  return (
    <div className="overflow-x-auto shadow rounded">
      <table className="min-w-full border-collapse bg-white">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase">
              Name
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase">
              Student ID
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase">
              Account ID
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase">
              Remaining Lessons
            </th>
          </tr>
        </thead>

        <tbody className="divide-y divide-gray-200">
          {students.length > 0 ? (
            students.map((student) => (
              <tr
                key={student.id}
                onClick={() => onStudentClick(student)}
                className="hover:bg-gray-50 transition-colors cursor-pointer"
              >
                <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900">
                  {student.name}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900">
                  {student.id}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900">
                  {student.account_id}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900">
                  {student.remaining_lessons ?? "—"}
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td
                colSpan={4}
                className="px-3 py-2 text-center text-xs text-gray-500"
              >
                No students found
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}