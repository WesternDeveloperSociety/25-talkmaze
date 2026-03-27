"use client";

import { useState } from "react";
import MyStudents from "./components/MyStudents";
import StudentDetails from "./components/StudentDetails";
import LessonsTable from "./components/LessonsTable";

interface Student {
  id: string;
  name: string;
  tw_id: string | null;
}

interface CoachPageClientProps {
  currentUserId: string;
  currentUserEmail: string;
}

export default function CoachPageClient({ currentUserId, currentUserEmail }: CoachPageClientProps) {
  const [activeStudent, setActiveStudent] = useState<Student | null>(null);
  const [openChatForStudent, setOpenChatForStudent] = useState<Student | null>(null);

  const handleMessageClick = (student: Student) => {
    setActiveStudent(student);
    setOpenChatForStudent(student); // signals StudentDetails to open chat
  };

  return (
    <div className="h-full w-full bg-white rounded-2xl p-8 shadow-sm overflow-y-auto">
      <h1 className="text-3xl font-bold mb-6 text-gray-900 border-b pb-4">Coach Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8 min-h-[500px]">
        <div className="h-full md:col-span-1">
          <MyStudents
            activeStudentId={activeStudent?.id}
            onStudentClick={setActiveStudent}
            onMessageClick={handleMessageClick}
          />
        </div>
        <div className="h-full md:col-span-3">
          <StudentDetails
            student={activeStudent}
            currentUserId={currentUserId}
            currentUserEmail={currentUserEmail}
            autoOpenChat={openChatForStudent?.id} // ← new prop
          />
        </div>
      </div>

      <LessonsTable studentId={activeStudent?.id} studentName={activeStudent?.name} />
    </div>
  );
}