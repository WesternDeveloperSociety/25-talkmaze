"use client";

import { TokenIcon } from "@/src/components/common/TokenIcon";
import type { LessonToken } from "../_hooks/useHomeData";

interface ReviewLessonCardProps {
  lessonNumber?: number;
  title?: string;
  token?: LessonToken | null;
  onClick?: () => void;
}

export default function ReviewLessonCard({
  lessonNumber = 7,
  title = "Overcoming Nerves",
  token,
  onClick,
}: ReviewLessonCardProps) {
  return (
    <div
      onClick={onClick}
      className="flex relative rounded-xl shadow-[0px_4px_4px_rgba(0,0,0,0.25)] overflow-hidden cursor-pointer w-full"
      style={{
        backgroundImage: "url('/images/backgrounds/lesson-card-bg.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* Label pill */}
      <div className="absolute left-[18px] top-[15px] bg-white rounded-xl shadow-[inset_0px_4px_4px_rgba(0,0,0,0.25)] px-3 h-[35px] flex items-center">
        <span className="text-[#1F2E3B] text-[16px] font-semibold whitespace-nowrap">
          Review: Lesson {lessonNumber}
        </span>
      </div>

      {/* Token icon box */}
      <div className="absolute right-[18px] top-[15px] w-[63px] h-[63px] bg-white rounded-xl shadow-[inset_0px_4px_4px_rgba(0,0,0,0.25)] flex items-center justify-center text-3xl">
        <TokenIcon
          iconUrl={token?.icon_url ?? null}
          title={token?.title ?? title}
          className="w-9 h-9 object-contain text-3xl"
        />
      </div>

      {/* Bottom green bar */}
      <div className="absolute bottom-0 left-0 w-full h-[80px] bg-[#65CFAD] flex items-center justify-center">
        <span className="text-white text-[20px] font-semibold text-center px-4">
          {title}
        </span>
      </div>
    </div>
  );
}
