"use client";

import { memo, type ReactNode } from "react";
import { TokenIcon } from "@/src/components/common/TokenIcon";
import { TokenMysteryStar } from "@/src/components/ui/icons";

type Props = {
  lessonNumber: number;
  title: string;
  tokenTitle?: string | null;
  icon: string | null;
  onClick: () => void;
  isCompleted?: boolean;
  isLocked?: boolean;
  /**
   * Custom indicator rendered next to the lesson number, replacing the default
   * completed/empty box. Lets callers supply their own status visual.
   */
  statusSlot?: ReactNode;
};

const LessonCard = memo(function LessonCard({
  lessonNumber,
  title,
  tokenTitle,
  icon,
  onClick,
  isCompleted,
  isLocked,
  statusSlot,
}: Props) {
  return (
    <div
      onClick={onClick}
      className={`relative w-full h-60 rounded-xl p-4 shadow-sm transition-all duration-300 cursor-pointer group ${
        isLocked
          ? "opacity-50 grayscale"
          : "hover:shadow-xl transform hover:-translate-y-1"
      }`}
      style={{
        backgroundImage: "url('/images/backgrounds/lesson-card-bg.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* Lesson number label & completion checkbox */}
      <div className="absolute top-4 left-5 flex items-center gap-2">
        <div className="bg-white text-black text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm group-hover:scale-110 transition-transform">
          Lesson {lessonNumber}
        </div>

        {/* Status indicator: caller-supplied slot, or default completed/empty box */}
        {statusSlot ?? (
          <div className="w-6 h-6 bg-white rounded-lg shadow-sm flex items-center justify-center group-hover:scale-110 transition-transform">
            {isCompleted ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#2B4257"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-4 h-4"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <div className="w-3.5 h-3.5 border-2 border-[#2B4257] rounded-sm" />
            )}
          </div>
        )}
      </div>

      {/* Reward token for the lesson */}
      <div className="absolute top-4 right-5 group/token">
        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-[#2B4257] text-white text-xs px-2 py-1 rounded opacity-0 group-hover/token:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
          {isLocked ? "???" : (tokenTitle ?? title)}
        </div>
        <div className="w-14 h-14 rounded-xl bg-white text-3xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
          {isLocked ? (
            <TokenMysteryStar size={36} />
          ) : (
            <TokenIcon
              iconUrl={icon}
              title={title}
              className="w-9 h-9 object-contain"
            />
          )}
        </div>
      </div>

      {/* Lesson title */}
      <div className="absolute bottom-0 left-0 w-full h-[85px] bg-[#66d0ae] rounded-b-xl flex items-center justify-center px-4">
        <span className="text-white font-bold text-center leading-tight">
          {title}
        </span>
      </div>
    </div>
  );
});

export default LessonCard;
