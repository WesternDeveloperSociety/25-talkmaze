import type { EventInput } from "@fullcalendar/core";
import type { CalendarEventKind } from "@/src/lib/scheduling/types";

/** Default legend labels; callsites may override per context. */
export const CALENDAR_EVENT_KIND_LABELS: Record<CalendarEventKind, string> = {
  session: "Booked",
  "session-pending-reschedule": "Reschedule pending",
  "availability-coach": "Coach available",
  "availability-student": "Student available",
  "availability-both": "Both available",
  "recurring-block": "Recurring block",
  proposed: "Proposed",
  conflict: "Conflict",
};

/**
 * The only kind -> presentation bridge. Colors live in
 * src/styles/calendar/event-kinds.css, keyed off the returned classNames -
 * the same classes CalendarLegend puts on its swatches.
 */
export function eventPropsForKind(
  kind: CalendarEventKind,
): Pick<EventInput, "classNames" | "display"> {
  return {
    classNames: ["tm-cal-event", `tm-cal-event--${kind}`],
    ...(kind === "recurring-block" ? { display: "background" as const } : null),
  };
}

/** Maps a booked session row to a calendar event. Title stays caller-built. */
export function sessionEvent(args: {
  id: string;
  title: string;
  start: string;
  end?: string | null;
  pendingReschedule?: boolean;
}): EventInput {
  return {
    id: args.id,
    title: args.title,
    start: args.start,
    end: args.end ?? undefined,
    ...eventPropsForKind(
      args.pendingReschedule ? "session-pending-reschedule" : "session",
    ),
  };
}
