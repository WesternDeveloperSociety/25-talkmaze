/**
 * Single source of truth for lesson-progress status codes and their labels.
 * `lesson_progress.status` is 1 = Not Started, 2 = In Progress, 3 = Completed.
 * Reused by the coach lesson-tasks grid/modal, the status badge, and the full
 * lesson detail editor. Pure constants — safe to import from client or server.
 */
export type LessonStatus = 1 | 2 | 3;

export const LESSON_STATUS_LABELS: Record<number, string> = {
  1: "Not Started",
  2: "In Progress",
  3: "Completed",
};

export const LESSON_STATUS_OPTIONS: { value: LessonStatus; label: string }[] = [
  { value: 1, label: "Not Started" },
  { value: 2, label: "In Progress" },
  { value: 3, label: "Completed" },
];
