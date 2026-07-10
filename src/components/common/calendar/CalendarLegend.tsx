import type { CalendarEventKind } from "@/src/lib/scheduling/types";
import { CALENDAR_EVENT_KIND_LABELS } from "./eventKinds";

interface CalendarLegendProps {
  items: { kind: CalendarEventKind; label?: string }[];
}

/**
 * Legend for ScheduleCalendar events. Swatches carry the same
 * .tm-cal-event--<kind> classes as the calendar events, so the legend
 * cannot drift from what the calendar renders.
 */
export default function CalendarLegend({ items }: CalendarLegendProps) {
  return (
    <div className="flex flex-wrap items-center gap-4 px-1">
      {items.map(({ kind, label }) => (
        <div key={kind} className="flex items-center gap-1.5">
          <span className={`tm-cal-swatch tm-cal-event--${kind}`} />
          <span className="text-white/40 text-xs">
            {label ?? CALENDAR_EVENT_KIND_LABELS[kind]}
          </span>
        </div>
      ))}
    </div>
  );
}
