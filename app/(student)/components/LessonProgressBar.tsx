"use client";

import React from "react";
//we need to get the course the user is in
//then we need to get the latest course completed


interface LessonProgressBarProps {
  current?: number;
  total?: number;
}

export default function LessonProgressBar({ current = 8, total = 24 }: LessonProgressBarProps) {
  // Clamp percentage between 0 and 100
  const progress = Math.min(Math.max((current / total) * 100, 0), 100);

  return (
    /* 
       Container: 
       - Fixed width/height based on Figma (729px x 93px)
       - max-w-full ensures it shrinks on mobile if needed 
    */
    <div
      className="relative bg-white rounded-[12px] shadow-[0px_4px_4px_rgba(0,0,0,0.25)] overflow-hidden box-border w-[100%] h-[100px]"
      style={{
        maxWidth: "100%", // Responsive safety
        flexShrink: 0,    // Prevents squishing in flex containers
      }}
    >
      {/* Internal Padding Container to mimic specific positions */}
      <div className="relative w-full h-full px-[15px] py-[16px] w-full">

        {/* Header Row */}
        <div className="flex justify-between items-center w-full mb-[18px]">
          <h2
            style={{
              color: "var(--talkmaze_turquoise, #2B4257)",
              fontSize: "16px",
              fontFamily: "Roboto, sans-serif",
              fontWeight: 600,
            }}
          >
            Lesson Progress
          </h2>
          <span
            style={{
              color: "var(--talkmaze_turquoise, #2B4257)",
              fontSize: "16px",
              fontFamily: "Roboto, sans-serif",
              fontWeight: 400,
            }}
          >
            {current}/{total}
          </span>
        </div>

        {/* Progress Bar Track */}
        <div
          className="relative w-full h-[17px] rounded-[10px]"
          style={{ backgroundColor: "var(--talkmaze_green_light, #B1E7D6)" }}
        >
          {/* Progress Bar Fill */}
          <div
            className="absolute left-0 top-0 h-full rounded-[10px] transition-all duration-500 ease-out"
            style={{
              width: `${progress}%`,
              backgroundColor: "var(--talkmaze_turquoise, #2B4257)",
            }}
          />
        </div>
      </div>
    </div>
  );
}