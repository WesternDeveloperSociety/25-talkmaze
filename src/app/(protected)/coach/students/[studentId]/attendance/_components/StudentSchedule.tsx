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

const STATUS_DOT: Record<AttendanceStatus, string> = {
  attended: "bg-emerald-500",
  missed: "bg-red-400",
  cancelled: "bg-gray-400",
};

interface Session {
  id: number;
  weekday: number;
  start_time: string;
  end_time: string;
  requested_start_time: string | null;
  requested_end_time: string | null;
  reschedule_status: "pending" | null;
}

interface StudentScheduleProps {
  sessions: Session[];
  loading: boolean;
  attendanceBySessionId?: Record<number, AttendanceStatus>;
  onMarkAttendance?: (session: Session, status: AttendanceStatus) => void;
  submittingSessionId?: number | null;
  onReschedule?: (session: Session) => void;
}

export default function StudentSchedule({
  sessions,
  loading,
  attendanceBySessionId = {},
  onMarkAttendance,
  submittingSessionId,
  onReschedule,
}: StudentScheduleProps) {
  if (loading) {
    return (
      <div className="animate-pulse space-y-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-10 bg-gray-200 rounded-lg" />
        ))}
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <p className="text-sm text-gray-400">No upcoming sessions scheduled.</p>
    );
  }

  return (
    <div className="space-y-2">
      {sessions.map((s) => {
        const currentStatus = attendanceBySessionId[s.id];
        const isSubmitting = submittingSessionId === s.id;
        const isPending = s.reschedule_status === "pending";

        return (
          <div
            key={s.id}
            className="bg-white border border-[#2B4257]/10 rounded-lg px-3 py-2.5 text-xs shadow-sm"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0 flex-wrap">
                <span className="font-semibold text-[#2B4257]/70 shrink-0">
                  {fmtLocalDate(s.start_time)}
                </span>
                <span className="text-gray-500 shrink-0">
                  {fmtLocalTime(s.start_time)} – {fmtLocalTime(s.end_time)}
                </span>
                {isPending && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-semibold uppercase tracking-wide">
                    ↻ Pending
                  </span>
                )}
              </div>
              {currentStatus && (
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[currentStatus]}`}
                />
              )}
            </div>

            {(onMarkAttendance || onReschedule) && (
              <div className="mt-2.5 flex gap-1.5 flex-wrap">
                {onMarkAttendance &&
                  STATUS_BUTTONS.map(({ status, label, activeClass }) => (
                    <button
                      key={status}
                      disabled={isSubmitting}
                      onClick={() => onMarkAttendance(s, status)}
                      className={`min-h-11 md:min-h-0 px-2.5 py-1 text-xs font-medium rounded border transition-colors disabled:opacity-60 ${
                        currentStatus === status
                          ? activeClass
                          : "border-[#2B4257]/20 text-gray-500 hover:border-[#2B4257]/40 hover:text-gray-700"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                {onReschedule && (
                  <button
                    onClick={() => onReschedule(s)}
                    className="min-h-11 md:min-h-0 px-2.5 py-1 text-xs font-medium rounded border border-[#2B4257]/40 text-[#2B4257] bg-[#2B4257]/5 hover:bg-[#2B4257]/10 transition-colors"
                  >
                    Reschedule
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
