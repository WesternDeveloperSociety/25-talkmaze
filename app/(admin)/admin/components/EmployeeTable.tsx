import { TeachworksEmployee } from "@/lib/teachworks/types";
import { Coach } from "./AssignStudentDropDown";

interface EmployeeTableProps {
  employees: Coach[];
  onEmployeeClick: (employee: Coach) => void;
}

export default function EmployeeTable({ employees, onEmployeeClick }: EmployeeTableProps) {
  return (
    <div className="overflow-x-auto shadow rounded">
      <table className="min-w-full border-collapse bg-white">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase">First Name</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase">Last Name</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase">Employee ID</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase">Position</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {employees.length > 0 ? (
            employees.map((employee) => (
              <tr 
                key={employee.id} 
                onClick={() => onEmployeeClick(employee)}
                className="hover:bg-gray-50 transition-colors cursor-pointer"
              >
                <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900">{employee.name}</td>
                <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900">{employee.id}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={4} className="px-3 py-2 text-center text-xs text-gray-500">
                No employees found
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
