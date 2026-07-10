"use client";

import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventContentArg, EventInput } from "@fullcalendar/core";
import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/src/utils/cn";
import Spinner from "@/src/components/ui/Spinner";

/**
 * Shared FullCalendar wrapper (styles in src/styles/calendar/).
 *
 * Hardwired config every consumer shares: dayGrid/timeGrid/interaction
 * plugins, block event display, 12-hour time labels, full-day time grid
 * scrolled to 07:00, no all-day slot, now indicator.
 *
 * Sizing is deliberately NOT this component's job — pass an explicit CSS
 * `height` and let the page layout own the math.
 */

type FullCalendarProps = ComponentProps<typeof FullCalendar>;

/**
 * Custom event renderer used by FullCalendar.
 *
 * Month cells are short, so events stay on one truncating row. Time grid events
 * have more vertical space, so they stack the time above the title.
 */
function renderEventContent(arg: EventContentArg) {
  if (arg.view.type === "dayGridMonth") {
    return (
      <div className="tm-cal-event-month">
        {arg.timeText && (
          <span className="tm-cal-event-month-time">{arg.timeText}</span>
        )}
        <span className="tm-cal-event-month-title">{arg.event.title}</span>
      </div>
    );
  }
  return (
    <div className="tm-cal-event-column">
      {arg.timeText && (
        <span className="tm-cal-event-column-time">{arg.timeText}</span>
      )}
      {arg.event.title && (
        <span className="tm-cal-event-column-title">{arg.event.title}</span>
      )}
    </div>
  );
}

/**
 * Maps simple component props to the CSS hooks defined in src/styles/calendar/
 *
 * The base `tm-calendar` class supplies shared structure. Variant classes only
 * switch visual themes or toolbar density.
 */
const scheduleCalendarVariants = cva("tm-calendar", {
  variants: {
    variant: {
      dark: "tm-calendar--dark",
      light: "tm-calendar--light",
    },
    toolbar: {
      default: "",
      compact: "tm-calendar--compact-toolbar",
    },
  },
  defaultVariants: {
    variant: "dark",
    toolbar: "default",
  },
});

/**
 * Public props for the shared calendar wrapper.
 *
 * Most props are intentionally small pass-throughs to FullCalendar so pages can
 * customize behavior without duplicating the common calendar configuration.
 */
interface ScheduleCalendarProps extends VariantProps<
  typeof scheduleCalendarVariants
> {
  events: EventInput[];
  /** Explicit CSS height (`"640px"`, `"calc(100vh - 360px)"`, `"clamp(...)"`). */
  height: string;
  initialView?: "dayGridMonth" | "timeGridWeek" | "timeGridDay";
  initialDate?: string;
  loading?: boolean;
  onEventClick?: FullCalendarProps["eventClick"];
  dayMaxEvents?: FullCalendarProps["dayMaxEvents"];
  dayMaxEventRows?: FullCalendarProps["dayMaxEventRows"];
  expandRows?: FullCalendarProps["expandRows"];
  moreLinkClick?: FullCalendarProps["moreLinkClick"];
  headerToolbar?: FullCalendarProps["headerToolbar"];
  className?: string;
}

/**
 * Shared scheduling calendar used across admin, coach, and family screens.
 *
 * This component owns the common FullCalendar setup and styling hooks. Callers
 * are responsible for creating events and choosing an explicit height that fits
 * their page layout.
 */
export default function ScheduleCalendar({
  events,
  height,
  initialView = "dayGridMonth",
  initialDate,
  loading = false,
  onEventClick,
  dayMaxEvents,
  dayMaxEventRows,
  expandRows,
  moreLinkClick,
  headerToolbar,
  variant,
  toolbar,
  className,
}: ScheduleCalendarProps) {
  // Keep loading UI local so consumers do not need to repeat the same wrapper.
  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Spinner className="size-7 text-accent" />
      </div>
    );
  }

  const isTimeGrid = initialView !== "dayGridMonth";
  // Default toolbar choices depend on the starting view, but callers can fully
  // override the toolbar when a page needs a different control set.
  const resolvedHeaderToolbar = headerToolbar ?? {
    left: "prev,next today",
    center: "title",
    right: isTimeGrid
      ? "timeGridWeek,timeGridDay"
      : "dayGridMonth,timeGridWeek",
  };

  return (
    <div
      className={cn(scheduleCalendarVariants({ variant, toolbar }), className)}
    >
      <FullCalendar
        // FullCalendar's plugins hold internal state that goes stale when
        // view/date props change after mount; remounting is the workaround.
        key={`${initialView}-${initialDate ?? "default"}`}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView={initialView}
        initialDate={initialDate}
        events={events}
        headerToolbar={resolvedHeaderToolbar}
        eventClick={onEventClick}
        dayMaxEvents={dayMaxEvents}
        dayMaxEventRows={dayMaxEventRows}
        expandRows={expandRows}
        moreLinkClick={moreLinkClick}
        height={height}
        // Block events fill their lane, which makes event kind colors easier to
        // scan than FullCalendar's default dot rendering.
        eventDisplay="block"
        eventTimeFormat={{
          hour: "2-digit",
          minute: "2-digit",
          meridiem: "short",
        }}
        eventContent={renderEventContent}
        // Show the full day in time-grid views, but initially scroll near the
        // most useful scheduling hours.
        slotMinTime="00:00:00"
        slotMaxTime="24:00:00"
        scrollTime="07:00:00"
        scrollTimeReset={false}
        allDaySlot={false}
        nowIndicator
      />
    </div>
  );
}
