"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronDown } from "lucide-react";
import StudentSchedule from "./StudentSchedule";
import CoachAttendanceSection from "./CoachAttendanceSection";
import RescheduleSessionModal from "@/src/app/(protected)/coach/_components/RescheduleSessionModal";
import Pagination from "@/src/components/common/Pagination";
import type { AttendanceStatus, CoachSession } from "./types";

const PAGE_SIZE = 5;

interface AttendanceResponseRecord {
  session_id: number | null;
  status: AttendanceStatus;
}

type AttendanceMarkableSession = Pick<CoachSession, "id" | "start_time">;

interface AttendancePanelProps {
  studentId: string;
  firstName: string | null;
  lastName: string | null;
}

/**
 * The Attendance tab body: upcoming schedule + past attendance with inline
 * marking and reschedule. Lifted verbatim from the former StudentDetails god
 * component; behaviour is unchanged, it just no longer carries chat/header.
 */
export default function AttendancePanel({
  studentId,
  firstName,
  lastName,
}: AttendancePanelProps) {
  const [allSessions, setAllSessions] = useState<CoachSession[]>([]);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [attendanceBySessionId, setAttendanceBySessionId] = useState<
    Record<number, AttendanceStatus>
  >({});
  const [submittingSessionId, setSubmittingSessionId] = useState<number | null>(
    null,
  );
  const [attendanceMessage, setAttendanceMessage] = useState<string | null>(
    null,
  );
  const [isScheduleOpen, setIsScheduleOpen] = useState(true);
  const [isAttendanceOpen, setIsAttendanceOpen] = useState(true);
  const [upcomingPage, setUpcomingPage] = useState(1);
  const [attendancePage, setAttendancePage] = useState(1);
  const [rescheduleTarget, setRescheduleTarget] = useState<CoachSession | null>(
    null,
  );

  // Fetch all sessions + existing attendance records together.
  const loadSessionsAndAttendance = useCallback(async (id: string) => {
    setLoadingSchedule(true);
    try {
      const [sessionsData, attendanceData] = await Promise.all([
        fetch(`/api/coach/sessions?student_id=${id}`).then((r) =>
          r.ok ? r.json() : { sessions: [] as CoachSession[] },
        ),
        fetch(`/api/attendance?student_id=${id}`).then((r) =>
          r.ok ? r.json() : { attendance: [] as AttendanceResponseRecord[] },
        ),
      ]);
      setAllSessions((sessionsData.sessions ?? []) as CoachSession[]);

      const map: Record<number, AttendanceStatus> = {};
      for (const record of (attendanceData.attendance ??
        []) as AttendanceResponseRecord[]) {
        if (record.session_id != null) {
          map[record.session_id] = record.status as AttendanceStatus;
        }
      }
      setAttendanceBySessionId(map);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingSchedule(false);
    }
  }, []);

  useEffect(() => {
    loadSessionsAndAttendance(studentId);
  }, [studentId, loadSessionsAndAttendance]);

  async function handleMarkAttendance(
    session: AttendanceMarkableSession,
    status: AttendanceStatus,
  ) {
    if (submittingSessionId === session.id) return;
    setAttendanceMessage(null);
    setSubmittingSessionId(session.id);
    const previousStatus = attendanceBySessionId[session.id];
    const isClearing = previousStatus === status;

    setAttendanceBySessionId((prev) => {
      if (!isClearing) return { ...prev, [session.id]: status };
      const next = { ...prev };
      delete next[session.id];
      return next;
    });

    try {
      const res = isClearing
        ? await fetch("/api/attendance", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              student_id: studentId,
              session_date: session.start_time.slice(0, 10),
              session_id: session.id,
            }),
          })
        : await fetch("/api/attendance", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              student_id: studentId,
              session_date: session.start_time.slice(0, 10),
              session_id: session.id,
              status,
            }),
          });
      if (!res.ok) throw new Error("Failed to save attendance");
      setAttendanceMessage(
        isClearing ? "Attendance cleared." : "Attendance updated.",
      );
    } catch {
      setAttendanceBySessionId((prev) => {
        const next = { ...prev };
        if (previousStatus == null) {
          delete next[session.id];
        } else {
          next[session.id] = previousStatus;
        }
        return next;
      });
      setAttendanceMessage("Could not update attendance. Please try again.");
    } finally {
      setSubmittingSessionId(null);
    }
  }

  // upcoming = future sessions not yet confirmed as attended/missed
  // attendance = past sessions OR any session already marked
  const now = new Date().toISOString();
  const upcomingSessions = allSessions.filter((s) => {
    if (!s.start_time || s.start_time < now) return false;
    return attendanceBySessionId[s.id] == null;
  });
  const attendanceSessions = allSessions
    .filter((s) => {
      if (!s.start_time) return false;
      return s.start_time < now || attendanceBySessionId[s.id] != null;
    })
    .sort((a, b) => (a.start_time < b.start_time ? 1 : -1));

  const upcomingTotalPages = Math.max(
    1,
    Math.ceil(upcomingSessions.length / PAGE_SIZE),
  );
  const attendanceTotalPages = Math.max(
    1,
    Math.ceil(attendanceSessions.length / PAGE_SIZE),
  );
  const clampedUpcomingPage = Math.min(upcomingPage, upcomingTotalPages);
  const clampedAttendancePage = Math.min(attendancePage, attendanceTotalPages);
  const visibleUpcoming = upcomingSessions.slice(
    (clampedUpcomingPage - 1) * PAGE_SIZE,
    clampedUpcomingPage * PAGE_SIZE,
  );
  const visibleAttendance = attendanceSessions.slice(
    (clampedAttendancePage - 1) * PAGE_SIZE,
    clampedAttendancePage * PAGE_SIZE,
  );

  return (
    <div className="flex flex-1 flex-col gap-4">
      {/* Schedule section */}
      <div className="rounded-xl border border-gray-100 bg-gray-50 p-5">
        <button
          type="button"
          onClick={() => setIsScheduleOpen((v) => !v)}
          className="mb-1 flex w-full items-center justify-between"
        >
          <h4 className="text-sm font-semibold text-[#2B4257]">
            Upcoming Schedule
          </h4>
          <ChevronDown
            size={16}
            className={`text-[#2B4257]/50 transition-transform duration-200 ${isScheduleOpen ? "rotate-0" : "-rotate-90"}`}
          />
        </button>
        {isScheduleOpen && (
          <>
            <p className="mb-3 text-xs text-gray-400">
              Mark attendance directly from each session row. All times shown in
              your local timezone.
            </p>
            {attendanceMessage && (
              <p
                className={`mb-3 text-xs ${
                  attendanceMessage.startsWith("Could not")
                    ? "text-red-600"
                    : "text-emerald-700"
                }`}
              >
                {attendanceMessage}
              </p>
            )}
            <StudentSchedule
              sessions={visibleUpcoming}
              loading={loadingSchedule}
              attendanceBySessionId={attendanceBySessionId}
              onMarkAttendance={handleMarkAttendance}
              submittingSessionId={submittingSessionId}
              onReschedule={setRescheduleTarget}
            />
            <Pagination
              currentPage={clampedUpcomingPage}
              totalPages={upcomingTotalPages}
              totalItems={upcomingSessions.length}
              itemsPerPage={PAGE_SIZE}
              onPageChange={setUpcomingPage}
              variant="light"
            />
          </>
        )}
      </div>

      {/* Attendance section */}
      <div className="rounded-xl border border-gray-100 bg-gray-50 p-5">
        <button
          type="button"
          onClick={() => setIsAttendanceOpen((v) => !v)}
          className="mb-4 flex w-full items-center justify-between"
        >
          <h4 className="text-sm font-semibold text-[#2B4257]">Attendance</h4>
          <ChevronDown
            size={16}
            className={`text-[#2B4257]/50 transition-transform duration-200 ${isAttendanceOpen ? "rotate-0" : "-rotate-90"}`}
          />
        </button>
        {isAttendanceOpen && (
          <>
            <CoachAttendanceSection
              sessions={visibleAttendance}
              loading={loadingSchedule}
              attendanceBySessionId={attendanceBySessionId}
              onMarkAttendance={handleMarkAttendance}
              submittingSessionId={submittingSessionId}
            />
            <Pagination
              currentPage={clampedAttendancePage}
              totalPages={attendanceTotalPages}
              totalItems={attendanceSessions.length}
              itemsPerPage={PAGE_SIZE}
              onPageChange={setAttendancePage}
              variant="light"
            />
          </>
        )}
      </div>

      {rescheduleTarget && (
        <RescheduleSessionModal
          session={{
            id: rescheduleTarget.id,
            start_time: rescheduleTarget.start_time,
            end_time: rescheduleTarget.end_time,
            requested_start_time: rescheduleTarget.requested_start_time,
            requested_end_time: rescheduleTarget.requested_end_time,
            reschedule_status: rescheduleTarget.reschedule_status,
            students: { first_name: firstName, last_name: lastName },
          }}
          onClose={() => setRescheduleTarget(null)}
          onSaved={async () => {
            setRescheduleTarget(null);
            await loadSessionsAndAttendance(studentId);
          }}
        />
      )}
    </div>
  );
}
