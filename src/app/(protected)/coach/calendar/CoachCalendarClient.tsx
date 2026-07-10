"use client";

import { useEffect, useState, useCallback } from "react";
import type { EventClickArg, EventInput } from "@fullcalendar/core";
import ScheduleCalendar from "@/src/components/common/calendar/ScheduleCalendar";
import { sessionEvent } from "@/src/components/common/calendar/eventKinds";
import RescheduleSessionModal, {
  type RescheduleSession,
} from "../_components/RescheduleSessionModal";
import { fullName } from "@/src/utils/formatName";

interface Session extends RescheduleSession {
  student_id: string | null;
}

/* Page padding + card padding above the calendar eat ~250px. */
const CALENDAR_HEIGHT = "calc(100vh - 250px)";

function studentName(s: Session["students"]) {
  return fullName(s?.first_name, s?.last_name, "Session");
}

export default function CoachCalendarClient() {
  const [events, setEvents] = useState<EventInput[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selected, setSelected] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  // §4 — calendar defaults to day view below md (week/month don't fit).
  const [isBelowMd, setIsBelowMd] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    setIsBelowMd(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setIsBelowMd(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const loadSessions = useCallback(async () => {
    const res = await fetch("/api/coach/sessions");
    const data = await res.json();
    const raw: Session[] = data.sessions ?? [];
    setSessions(raw);
    setEvents(
      raw.map((s) => {
        const isPending = s.reschedule_status === "pending";
        return sessionEvent({
          id: String(s.id),
          title: isPending
            ? `↻ ${studentName(s.students)}`
            : studentName(s.students),
          start: s.start_time,
          end: s.end_time,
          pendingReschedule: isPending,
        });
      }),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const handleEventClick = (arg: EventClickArg) => {
    const session = sessions.find((s) => String(s.id) === arg.event.id);
    if (!session) return;
    setSelected(session);
  };

  return (
    <div className="w-full h-full p-4 md:p-6 mx-auto">
      <div className="bg-[#1F2E3B] rounded-2xl p-4 border border-white/5">
        <ScheduleCalendar
          events={events}
          initialView={isBelowMd ? "timeGridDay" : "dayGridMonth"}
          loading={loading}
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

      {selected && (
        <RescheduleSessionModal
          session={selected}
          onClose={() => setSelected(null)}
          onSaved={async () => {
            setSelected(null);
            await loadSessions();
          }}
        />
      )}
    </div>
  );
}
