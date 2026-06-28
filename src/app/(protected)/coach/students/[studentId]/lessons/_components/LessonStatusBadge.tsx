import { LESSON_STATUS_LABELS } from "@/src/lib/lessons/lessonStatus";

/**
 * Tri-state lesson-progress indicator for the coach lesson cards. Rendered into
 * `LessonCard`'s `statusSlot`, so it mirrors the default box's white chip styling.
 * 1 = empty grey circle, 2 = amber dot, 3 = green check.
 */
export default function LessonStatusBadge({ status }: { status: number }) {
  const label = LESSON_STATUS_LABELS[status] ?? "Unknown";

  return (
    <div
      className="w-6 h-6 bg-white rounded-lg shadow-sm flex items-center justify-center group-hover:scale-110 transition-transform"
      title={label}
      aria-label={label}
    >
      {status === 3 ? (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#15803d"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-4 h-4"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : status === 2 ? (
        <div className="w-3 h-3 rounded-full bg-amber-400" />
      ) : (
        <div className="w-3.5 h-3.5 rounded-full border-2 border-gray-400" />
      )}
    </div>
  );
}
