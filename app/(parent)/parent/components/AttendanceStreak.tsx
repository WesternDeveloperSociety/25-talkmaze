"use client";

import React from "react";

export default function AttendanceStreak({ streak = 8, studentId }: { streak?: number, studentId?: string }) {
  // Mock grid of attendance status
  const attendance = [
    { type: 'star', filled: true },
    { type: 'x', filled: false },
    { type: 'star', filled: true },
    { type: 'star', filled: true },
    { type: 'star', filled: true },
    { type: 'star', filled: true },
    { type: 'star', filled: true },
    { type: 'star', filled: true },
    { type: 'star', filled: true },
    { type: 'star', filled: true },
    { type: 'empty', filled: false },
    { type: 'empty', filled: false },
  ];

  return (
    <div className="bg-[#B1E7D6] rounded-2xl p-5 shadow-[0_4px_4px_rgba(0,0,0,0.25)] flex flex-col gap-3 h-full">
      <div className="flex flex-col">
        <span className="text-3xl font-bold text-[#1F2E3B] leading-none">{streak}</span>
        <span className="text-[#1F2E3B] font-semibold text-xs">attendance streak</span>
      </div>

      <div className="grid grid-cols-6 gap-2 mt-2">
        {attendance.map((item, index) => (
          <div key={index} className="flex items-center justify-center">
            {item.type === 'star' && (
              <svg width="24" height="24" viewBox="0 0 24 24" fill={item.filled ? "#8E97FD" : "#1F2E3B"} className={item.filled ? "" : "opacity-30"}>
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            )}
            {item.type === 'x' && (
              <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center text-white font-bold text-[10px] ring-2 ring-white">
                ✕
              </div>
            )}
            {item.type === 'empty' && (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="#1F2E3B" className="opacity-30">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
