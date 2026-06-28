"use client";

import { memo, useMemo } from "react";
import { Card } from "@/src/components/ui/card";

type Props = {
  completed: number; // number of lessons the student has completed
  total: number; // total lessons in the course
  width?: string; // optional Tailwind width class, e.g. "w-full"
};

/**
 * Shows the student's overall lesson completion as a progress bar.
 */
const ProgressCard = memo(function ProgressCard({
  completed,
  total,
  width,
}: Props) {
  // Avoid divide-by-zero if lessons haven't loaded yet
  const percent = useMemo(
    () => (total > 0 ? Math.round((completed / total) * 100) : 0),
    [completed, total],
  );

  return (
    <Card
      variant="light"
      shadow="lg"
      className={`h-25 justify-center rounded-lg md:px-8 md:py-6 ${width ?? ""}`}
    >
      {/* "Lesson Progress (completed/total) */}
      <div className="flex justify-between items-center font-bold text-sm mb-3">
        <span>Lesson Progress</span>
        <span className="text-gray-500">
          {completed}/{total}
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-4 bg-[#B1E7D6] rounded-full overflow-hidden">
        <div
          className="h-full bg-[#2B4257] rounded-full transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
    </Card>
  );
});

export default ProgressCard;
