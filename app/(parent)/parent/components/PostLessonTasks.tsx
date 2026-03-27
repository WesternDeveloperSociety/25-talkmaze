"use client";

import React, { useState } from "react";

export default function PostLessonTasks({ studentId }: { studentId?: string }) {
  const [enabled, setEnabled] = useState(true);
  const [days, setDays] = useState(0);

  return (
    <div className="bg-[#B1E7D6] rounded-2xl p-5 shadow-[0_4px_4px_rgba(0,0,0,0.25)] flex flex-col gap-4 h-full justify-between">
      <h3 className="text-[#1F2E3B] font-bold text-base text-center leading-tight px-2">
        Do you want your child to have post-lesson tasks?
      </h3>

      <div className="flex gap-3 justify-center">
        <button
          onClick={() => setEnabled(true)}
          className={`flex-1 py-2 rounded-xl text-sm font-bold transition-colors ${
            enabled ? "bg-[#1F2E3B] text-white" : "bg-white/50 text-[#1F2E3B]"
          }`}
        >
          Yes
        </button>
        <button
          onClick={() => setEnabled(false)}
          className={`flex-1 py-2 rounded-xl text-sm font-bold transition-colors ${
            !enabled ? "bg-[#1F2E3B] text-white" : "bg-white/50 text-[#1F2E3B]"
          }`}
        >
          No
        </button>
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-[#1F2E3B] font-semibold text-[11px] leading-tight flex-1">
          How many days of post-lesson tasks?
        </p>
        <div className="flex items-center bg-[#1F2E3B] text-white rounded-full px-3 py-1 gap-3">
          <button 
            onClick={() => setDays(Math.max(0, days - 1))}
            className="text-lg font-bold hover:text-[#B1E7D6]"
          >
            −
          </button>
          <span className="text-sm font-bold min-w-[16px] text-center">{days}</span>
          <button 
            onClick={() => setDays(days + 1)}
            className="text-lg font-bold hover:text-[#B1E7D6]"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}
