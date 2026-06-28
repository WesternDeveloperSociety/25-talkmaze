"use client";

import type { AttendanceStatus } from "./types";
import { fmtLocalDate, fmtLocalTime } from "@/src/utils/formatDateTime";

const STATUS_BUTTONS: {
  status: AttendanceStatus;
  label: string;
  activeClass: string;
}[] = [
  {
    status: "attended",
    label: "Attended",
    activeClass: "bg-emerald-600 text-white border-emerald-600",
  },
  {
    status: "missed",
    label: "Missed",
    activeClass: "bg-red-500 text-white border-red-500",
  },
  {
    status: "cancelled",
    label: "Cancelled",
    activeClass: "bg-gray-400 text-white border-gray-400",
  },
];

interface PastSession {
  id: number;
  start_time: string;
  end_time: string | null;
}

interface CoachAttendanceSectionProps {
  sessions: PastSession[];
  loading: boolean;
  attendanceBySessionId: Record<number, AttendanceStatus>;
  onMarkAttendance: (session: PastSession, status: AttendanceStatus) => void;
  submittingSessionId: number | null;
}

export default function CoachAttendanceSection({
  sessions,
  loading,
  attendanceBySessionId,
  onMarkAttendance,
  submittingSessionId,
}: CoachAttendanceSectionProps) {
  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-14 bg-gray-200 rounded-lg" />
        ))}
      </div>
    );
  }

  if (sessions.length === 0) {
    return <p className="text-sm text-gray-400">No past sessions yet.</p>;
  }

  return (
    <div className="space-y-2">
      {sessions.map((session) => {
        const current = attendanceBySessionId[session.id];
        const isSubmitting = submittingSessionId === session.id;

        return (
          <div
            key={session.id}
            className="bg-white border border-[#2B4257]/10 rounded-lg px-3 py-2.5 shadow-sm"
          >
            <p className="text-xs font-medium text-gray-700 mb-2">
              {fmtLocalDate(session.start_time, false)}
              {" · "}
              {fmtLocalTime(session.start_time)}
            </p>
            <div className="flex gap-1.5 flex-wrap">
              {STATUS_BUTTONS.map(({ status, label, activeClass }) => (
                <button
                  key={status}
                  disabled={isSubmitting}
                  onClick={() => onMarkAttendance(session, status)}
                  className={`min-h-11 md:min-h-0 px-2.5 py-1 text-xs font-medium rounded-md border transition-colors disabled:opacity-60 ${
                    current === status
                      ? activeClass
                      : "border-[#2B4257]/20 text-gray-500 hover:border-[#2B4257]/40 hover:text-gray-700"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
