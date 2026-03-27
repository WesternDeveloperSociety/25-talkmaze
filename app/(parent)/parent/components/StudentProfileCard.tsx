"use client";

import React from "react";
import Image from "next/image";

interface StudentProfileCardProps {
  name: string;
  location: string;
  dob: string;
  grade: string | number;
  description: string;
  glows: string;
  grows: string;
  imageUrl?: string;
  onNext?: () => void;
  onPrev?: () => void;
  currentIndex?: number;
  totalStudents?: number;
}

export default function StudentProfileCard({
  name = "Priya",
  location = "Location",
  dob = "April 11, 2016",
  grade = "3",
  description = "Sweet and outgoing personality",
  glows = "Excited to learn and share",
  grows = "Clarity with content",
  imageUrl = "https://placehold.co/120x120",
  onNext,
  onPrev,
  currentIndex = 0,
  totalStudents = 1
}: StudentProfileCardProps) {
  return (
    <div className="bg-[#B1E7D6] rounded-2xl p-6 shadow-[0_4px_4px_rgba(0,0,0,0.25)] relative overflow-hidden h-full flex flex-col">
      {/* Background Pattern (Optional - simple illustration of the leaf pattern) */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
          {/* We could use a leaf pattern here if available, but for now we'll skip it or use a simple SVG */}
      </div>

      <div className="flex justify-between items-start mb-4 relative z-10">
        <div className="flex flex-col">
          <h2 className="text-[#1F2E3B] text-xl font-bold">TalkMaze Student Profile</h2>
          {totalStudents > 1 && (
            <div className="flex items-center gap-3 mt-2 bg-[#1F2E3B]/10 px-3 py-1.5 rounded-full w-fit">
              <button 
                onClick={onPrev}
                className="w-7 h-7 rounded-full bg-[#1F2E3B] text-white flex items-center justify-center hover:bg-[#2B4257] transition-all shadow-sm active:scale-95"
                title="Previous Student"
              >
                <span className="text-lg">‹</span>
              </button>
              <div className="flex flex-col items-center">
                <span className="text-[9px] font-bold text-[#1F2E3B]/40 uppercase tracking-widest leading-none">Switching</span>
                <span className="text-[11px] font-extrabold text-[#1F2E3B] leading-tight">
                  {currentIndex + 1} of {totalStudents}
                </span>
              </div>
              <button 
                onClick={onNext}
                className="w-7 h-7 rounded-full bg-[#1F2E3B] text-white flex items-center justify-center hover:bg-[#2B4257] transition-all shadow-sm active:scale-95"
                title="Next Student"
              >
                <span className="text-lg">›</span>
              </button>
            </div>
          )}
        </div>
        <button className="bg-[#1F2E3B] text-white text-xs px-3 py-1 rounded flex items-center gap-1">
          <span className="text-[10px]">✏️</span> EDIT
        </button>
      </div>

      <div className="flex flex-row gap-4 items-start relative z-10 flex-1">
        <div className="flex flex-col items-center gap-2 min-w-[120px]">
            <div className="w-24 h-24 rounded-full border-4 border-white overflow-hidden shadow-md">
                <img src={imageUrl} alt={name} className="w-full h-full object-cover" />
            </div>
            <p className="text-[#1F2E3B] font-bold text-base">{name}</p>
        </div>

        <div className="flex flex-col gap-3 flex-1">
           <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[#1F2E3B] text-xs">
                <div className="flex items-center gap-1 font-semibold">
                    <span>📍</span> Location
                </div>
                <div className="truncate text-right">{location}</div>
                
                <div className="font-semibold">Date of Birth</div>
                <div className="text-right">{dob}</div>

                <div className="font-semibold">Grade</div>
                <div className="text-right">{grade}</div>
           </div>

           <div className="bg-white/80 rounded-xl p-3 text-[#1F2E3B] text-[11px] leading-tight italic shadow-inner mt-auto">
                <p>"{description}</p>
                <p>Glows: {glows}</p>
                <p>Grows: {grows}"</p>
           </div>
        </div>
      </div>
    </div>
  );
}
