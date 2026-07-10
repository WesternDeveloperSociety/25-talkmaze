import ScheduleCalendar from "@/src/components/common/calendar/ScheduleCalendar";
import CalendarLegend from "@/src/components/common/calendar/CalendarLegend";
import { eventPropsForKind } from "@/src/components/common/calendar/eventKinds";
import type {
  PendingBookingForm,
  PendingBookingPreviewPayload,
} from "@/src/lib/scheduling/types";
import type { Coach } from "../../_types";

/* Edit form + legend + page padding above the calendar eat ~420px. */
const CALENDAR_HEIGHT = "calc(100vh - 420px)";

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const selectClass =
  "w-full bg-[#162330] border border-white/10 text-white rounded-lg px-2 py-2 text-sm focus:outline-none focus:border-[#B1E7D6]/40";

interface PendingBookingDetailProps {
  form: PendingBookingForm;
  employees: Coach[];
  preview: PendingBookingPreviewPayload | null;
  previewLoading: boolean;
  previewError: string;
  isEditing: boolean;
  isSaving: boolean;
  isApproving: boolean;
  initialCalendarDate: string | undefined;
  onFormChange: <K extends keyof PendingBookingForm>(
    key: K,
    value: PendingBookingForm[K],
  ) => void;
  onSave: () => void;
  onApprove: () => void;
  onStartEditing: () => void;
}

/**
 * Detail panel for a selected pending booking.
 */
export default function PendingBookingDetail({
  form,
  employees,
  preview,
  previewLoading,
  previewError,
  isEditing,
  isSaving,
  isApproving,
  initialCalendarDate,
  onFormChange,
  onSave,
  onApprove,
  onStartEditing,
}: PendingBookingDetailProps) {
  /**
   * Triggers edit mode on the first field change if it hasn't been entered yet.
   * This way the user doesn't need to click an explicit "Edit" button.
   */
  function maybeStartEditing() {
    if (!isEditing) onStartEditing();
  }

  /**
   * Derives the weekday from a YYYY-MM-DD date string so that selecting a
   * start date also auto-fills the weekday selector.
   * Uses UTC noon to avoid day-boundary shifts from local timezone offsets.
   */
  function weekdayFromDateInput(value: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    return new Date(`${value}T12:00:00Z`).getUTCDay();
  }

  return (
    <div className="space-y-4">
      {/* Edit form + action buttons */}
      <div className="bg-[#1F2E3B] rounded-2xl p-4 border border-white/5">
        <div className="flex flex-col lg:flex-row lg:items-end gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-7 gap-3 flex-1">
            <div>
              <p className="text-white/35 text-[10px] uppercase tracking-wider mb-1">
                Coach
              </p>
              <select
                value={form.coach_id}
                onChange={(e) => {
                  maybeStartEditing();
                  onFormChange("coach_id", e.target.value);
                }}
                className={selectClass}
              >
                {employees.map((coach) => (
                  <option key={coach.id} value={coach.id}>
                    {`${coach.first_name ?? ""} ${coach.last_name ?? ""}`.trim() ||
                      "Coach"}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <p className="text-white/35 text-[10px] uppercase tracking-wider mb-1">
                Day
              </p>
              <select
                value={form.weekday}
                onChange={(e) => {
                  maybeStartEditing();
                  onFormChange("weekday", Number(e.target.value));
                }}
                className={selectClass}
              >
                {WEEKDAYS.map((day, index) => (
                  <option key={day} value={index}>
                    {day}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <p className="text-white/35 text-[10px] uppercase tracking-wider mb-1">
                Start date
              </p>
              <input
                type="date"
                value={form.start_date}
                onChange={(e) => {
                  maybeStartEditing();
                  onFormChange("start_date", e.target.value);
                  // Auto-sync the weekday selector when a date is chosen.
                  const weekday = weekdayFromDateInput(e.target.value);
                  if (weekday != null) onFormChange("weekday", weekday);
                }}
                className={selectClass}
              />
            </div>
            <div>
              <p className="text-white/35 text-[10px] uppercase tracking-wider mb-1">
                Start
              </p>
              <input
                type="time"
                value={form.start_time}
                onChange={(e) => {
                  maybeStartEditing();
                  onFormChange("start_time", e.target.value);
                }}
                className={selectClass}
              />
            </div>
            <div>
              <p className="text-white/35 text-[10px] uppercase tracking-wider mb-1">
                End
              </p>
              <input
                type="time"
                value={form.end_time}
                onChange={(e) => {
                  maybeStartEditing();
                  onFormChange("end_time", e.target.value);
                }}
                className={selectClass}
              />
            </div>
            <div>
              <p className="text-white/35 text-[10px] uppercase tracking-wider mb-1">
                Timezone
              </p>
              <input
                type="text"
                value={form.timezone}
                onChange={(e) => {
                  maybeStartEditing();
                  onFormChange("timezone", e.target.value);
                }}
                className={selectClass}
              />
            </div>
            <div>
              <p className="text-white/35 text-[10px] uppercase tracking-wider mb-1">
                Sessions
              </p>
              <input
                type="number"
                min={1}
                step={1}
                value={form.num_sessions}
                onChange={(e) => {
                  maybeStartEditing();
                  onFormChange("num_sessions", Number(e.target.value));
                }}
                className={selectClass}
              />
            </div>
          </div>

          <div className="flex gap-2">
            {/* Save is only active when there are unsaved edits. */}
            <button
              onClick={onSave}
              disabled={isSaving || !isEditing}
              className="min-h-[44px] md:min-h-0 px-4 py-2 text-xs font-semibold text-[#1F2E3B] bg-[#B1E7D6] hover:bg-[#9ed4c1] disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors"
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
            {/* Approve is blocked while editing (unsaved changes) or when the preview shows conflicts. */}
            <button
              onClick={onApprove}
              disabled={
                isApproving ||
                previewLoading ||
                !preview?.canApprove ||
                isEditing
              }
              className="min-h-[44px] md:min-h-0 px-4 py-2 text-xs font-semibold text-[#1F2E3B] bg-[#65CFAD] hover:bg-[#50bfa0] disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors"
            >
              {isApproving ? "Approving..." : "Approve"}
            </button>
          </div>
        </div>

        {/* Status line: communicates why Approve may be disabled. */}
        <div className="mt-4 flex flex-wrap gap-3 text-xs">
          <span className="text-white/45">
            {isEditing
              ? "Save changes before approving"
              : previewLoading
                ? "Checking schedule..."
                : previewError
                  ? previewError
                  : preview?.canApprove
                    ? `Ready: ${preview.generatedCount}/${preview.requestedCount} sessions can be created`
                    : `Blocked: ${preview?.generatedCount ?? 0}/${preview?.requestedCount ?? form.num_sessions} sessions can be created`}
          </span>
        </div>
      </div>

      {/* Calendar event legend — same kind classes as the events, can't drift */}
      <CalendarLegend
        items={[
          { kind: "availability-coach", label: "Coach only" },
          { kind: "availability-student", label: "Student only" },
          { kind: "availability-both" },
          { kind: "session", label: "Existing" },
          { kind: "recurring-block" },
          { kind: "proposed" },
          { kind: "conflict" },
        ]}
      />

      {/* Calendar preview — scrolls to the first proposed/conflict date via initialCalendarDate */}
      <div className="bg-[#1F2E3B] rounded-2xl p-4 border border-white/5">
        <ScheduleCalendar
          events={
            preview?.events.map((e) => ({
              ...e,
              ...eventPropsForKind(e.kind),
            })) ?? []
          }
          initialView="timeGridWeek"
          initialDate={initialCalendarDate}
          loading={previewLoading}
          height={CALENDAR_HEIGHT}
        />
      </div>
    </div>
  );
}
