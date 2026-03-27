import { TeachworksCourse } from "@/lib/teachworks/types";

interface CourseTableProps {
  courses: TeachworksCourse[];
  onCourseClick: (course: TeachworksCourse) => void;
}

export default function CourseTable({ courses, onCourseClick }: CourseTableProps) {
  
  
  return (
    <div className="overflow-x-auto shadow rounded">
      <table className="min-w-full border-collapse bg-white">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase">Name</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase">Course ID</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase">Description</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {courses.length > 0 ? (
            courses.map((course) => (
              <tr
                key={course.id}
                onClick={() => onCourseClick(course)}
                className="hover:bg-gray-50 transition-colors cursor-pointer"
              >
                <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900 font-medium">{course.name}</td>
                <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900">{course.id}</td>
                <td className="px-3 py-2 text-xs text-gray-500 max-w-xs truncate">{course.description || "—"}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={3} className="px-3 py-2 text-center text-xs text-gray-500">
                No courses found
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}