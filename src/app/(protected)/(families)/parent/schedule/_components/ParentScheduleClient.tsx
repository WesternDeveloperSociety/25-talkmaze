"use client";

import { useMemo, useState } from "react";
import type { EventClickArg, EventInput } from "@fullcalendar/core";
import ScheduleCalendar from "@/src/components/common/calendar/ScheduleCalendar";
import { sessionEvent } from "@/src/components/common/calendar/eventKinds";
import EditStudentAvailabilityModal from "./EditStudentAvailabilityModal";
import SessionRescheduleModal from "./SessionRescheduleModal";
import SchedulePanel from "./SchedulePanel";
import type { SessionProp, StudentProp } from "./types";
import { Button } from "@/src/components/ui/button";

const CALENDAR_HEIGHT = "clamp(520px, calc(100vh - 290px), 610px)";

export type { SessionProp, StudentProp } from "./types";

interface Props {
  students: StudentProp[];
  sessions: SessionProp[];
}

export default function ParentScheduleClient({ students, sessions }: Props) {
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [showAvailability, setShowAvailability] = useState(false);
  const [selectedSession, setSelectedSession] = useState<SessionProp | null>(
    null,
  );
  const [modalMode, setModalMode] = useState<"view" | "edit">("view");
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null,
  );

  const filteredSessions = useMemo(() => {
    if (!selectedStudent) return sessions;
    return sessions.filter((session) => session.student_id === selectedStudent);
  }, [sessions, selectedStudent]);

  const handleSelectStudent = (id: string | null) => {
    setSelectedStudent(id);
    setSelectedSessionId(null);
  };

  const calendarEvents = useMemo<EventInput[]>(
    () =>
      filteredSessions.map((session) =>
        sessionEvent({
          id: session.id,
          title: session.coachName
            ? `${session.studentName} · ${session.coachName}`
            : session.studentName,
          start: session.start_time,
          end: session.end_time,
        }),
      ),
    [filteredSessions],
  );

  const handleEventClick = (arg: EventClickArg) => {
    const matched =
      filteredSessions.find((session) => session.id === arg.event.id) ??
      sessions.find((session) => session.id === arg.event.id) ??
      null;

    if (matched) {
      setModalMode("view");
      setSelectedSession(matched);
    }
  };

  const handleReschedule = () => {
    const session = filteredSessions.find((s) => s.id === selectedSessionId);
    if (!session) return;
    setModalMode(session.reschedule_status === "pending" ? "view" : "edit");
    setSelectedSession(session);
  };

  const handleCloseModal = () => {
    setSelectedSession(null);
    setModalMode("view");
  };

  return (
    <>
      <div className="flex w-full h-full px-[clamp(12px,1.5vw,24px)] py-[clamp(12px,1.5vw,24px)] overflow-x-hidden overflow-y-auto">
        <div className="w-full lg:h-full min-h-0 max-w-[1512px] mx-auto grid grid-cols-1 lg:grid-cols-[minmax(0,800px)_clamp(300px,30vw,402px)] lg:grid-rows-[1fr] gap-[clamp(12px,1.2vw,20px)] justify-center">
          {/* Calendar */}
          <section className="min-h-0 min-w-0 flex flex-col items-center lg:self-center">
            <div className="w-full max-w-[800px] bg-white rounded-[20px] p-3 lg:p-4 border border-[#DCE8E5] shadow-[0_8px_20px_rgba(31,46,59,0.08)] overflow-x-auto">
              <ScheduleCalendar
                events={calendarEvents}
                initialView="dayGridMonth"
                variant="light"
                toolbar="compact"
                height={CALENDAR_HEIGHT}
                onEventClick={handleEventClick}
                dayMaxEventRows
                expandRows
                moreLinkClick="day"
                headerToolbar={{
                  left: "prev,next today",
                  center: "title",
                  right: "dayGridMonth,timeGridWeek,timeGridDay",
                }}
              />
            </div>
          </section>

          <section className="min-h-0 flex flex-col items-stretch lg:items-end gap-3 lg:self-center">
            <div className="w-full h-[400px] lg:h-[clamp(520px,calc(100vh-290px),760px)]">
              <SchedulePanel
                students={students}
                selectedStudent={selectedStudent}
                onSelectStudent={handleSelectStudent}
                sessions={filteredSessions}
                onShowAllStudents={() => handleSelectStudent(null)}
                selectedSessionId={selectedSessionId}
                onSelectSession={setSelectedSessionId}
                onReschedule={handleReschedule}
              />
            </div>

            <Button
              variant="default"
              size="md"
              onClick={() => setShowAvailability(true)}
            >
              Edit Student Availability
            </Button>
          </section>
        </div>
      </div>

      {showAvailability && (
        <EditStudentAvailabilityModal
          students={students}
          initialStudentId={selectedStudent}
          onClose={() => setShowAvailability(false)}
        />
      )}

      {selectedSession && (
        <SessionRescheduleModal
          session={selectedSession}
          onClose={handleCloseModal}
          initialMode={modalMode}
        />
      )}
    </>
  );
}
