"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/src/components/ui/badge";
import { Card } from "@/src/components/ui/card";
import { fmtLocalTime } from "@/src/utils/formatDateTime";
import type { StudentOverviewUpcomingSession } from "../_lib/getStudentOverview";

interface OverviewUpcomingSessionsProps {
  sessions: StudentOverviewUpcomingSession[];
}

/**
 * Read-only "Upcoming sessions" panel for the Overview tab. Times are formatted
 * in the viewer's timezone (client-side), matching the rest of the dashboard.
 * Attendance-marking and reschedule live in the Attendance tab.
 */
export default function OverviewUpcomingSessions({
  sessions,
}: OverviewUpcomingSessionsProps) {
  return (
    <Card variant="light" padding="md" shadow="md" className="gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#2B4257]">
          Upcoming sessions
        </h3>
        <Link
          href="/coach/calendar"
          className="inline-flex items-center gap-0.5 text-xs font-medium text-[#2B4257]/70 hover:text-[#2B4257]"
        >
          View calendar
          <ChevronRight size={14} strokeWidth={2.5} aria-hidden />
        </Link>
      </div>

      {sessions.length === 0 ? (
        <p className="text-sm text-gray-400">No upcoming sessions scheduled.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {sessions.map((session) => {
            const start = new Date(session.start_time);
            const month = start
              .toLocaleDateString("en-US", { month: "short" })
              .toUpperCase();
            const day = start.getDate();
            const weekday = start.toLocaleDateString("en-US", {
              weekday: "long",
            });
            const isPending = session.reschedule_status === "pending";

            return (
              <li
                key={session.id}
                className="flex items-center gap-3 rounded-xl border border-[#2B4257]/10 px-3 py-2.5"
              >
                <div className="flex w-11 shrink-0 flex-col items-center rounded-lg bg-[#2B4257]/5 py-1 leading-tight">
                  <span className="text-[10px] font-semibold text-[#2B4257]/60">
                    {month}
                  </span>
                  <span className="text-lg font-bold text-[#1F2E3B]">
                    {day}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[#1F2E3B]">
                    {weekday}
                  </p>
                  <p className="text-xs text-[#2B4257]/60">
                    {fmtLocalTime(session.start_time)}
                    {session.end_time
                      ? ` – ${fmtLocalTime(session.end_time)}`
                      : ""}
                  </p>
                </div>
                <Badge variant={isPending ? "warning" : "primary"}>
                  {isPending ? "Reschedule" : "Confirmed"}
                </Badge>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
