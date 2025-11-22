"use client";

import { useRouter } from "next/navigation";

export default function Page() {
  const router = useRouter();

  return (
    <div className="w-full h-screen flex justify-center px-4 overflow-hidden">
      {/* Dark container */}
      <div
        className="bg-[#1f2e3b] w-full max-w-[94%] min-w-[300px] text-white rounded-2xl p-6 flex flex-col"
        style={{
          boxShadow: "inset 0 4px 12px rgba(0,0,0,0.6)",
        }}
      >
        {/* FIXED TOP EMPTY SPACE */}
        <div className="h-28 shrink-0"></div>

        {/* SCROLLABLE LESSON GRID */}
        <div
          className="grid gap-x-5 gap-y-4 justify-center auto-rows-[244px] 
                     grid-cols-[repeat(auto-fit,minmax(200px,371px))]
                     flex-grow overflow-y-auto pr-2"
        >
          <LessonCard lessonNumber={1} title="Intro to Debate" />
          <LessonCard lessonNumber={2} title="Constructing an Argument" />
          <LessonCard lessonNumber={3} title="Debate Speeches" />
          <LessonCard
            lessonNumber={4}
            title="Speaker Responsibilities for British Parliamentary Debate"
          />
          <LessonCard
            lessonNumber={5}
            title="How to Win from Every Position in BP"
          />
          <LessonCard lessonNumber={6} title="Practice Session" />
          <LessonCard lessonNumber={7} title="Overcoming Nerves" />
          <LessonCard
            lessonNumber={8}
            title="Strategies for Breathing and Speaking"
          />
          <LessonCard lessonNumber={9} title="Speech Blocking" />
        </div>
      </div>
    </div>
  );
}

function LessonCard({ lessonNumber, title }: any) {
  return (
    <div className="relative w-full max-w-[370px] h-full max-h-[236px] rounded-2xl flex flex-col justify-center bg-[#adf0c6] p-4">
      {/* TOP-LEFT LESSON BOX */}
      <div
        className="absolute bg-white text-black flex items-center justify-center rounded px-2 py-1 shadow-inner"
        style={{
          top: "15px",
          left: "20px",
          width: "103px",
          height: "35px",
          borderRadius: "9px",
          boxShadow: "inset 0 2px 6px rgba(0,0,0,0.6)",
        }}
      >
        <b>Lesson {lessonNumber}</b>
      </div>

      {/* TOP-RIGHT ICON BOX */}
      <div
        className="absolute bg-white text-black flex items-center justify-center rounded shadow-inner"
        style={{
          top: "15px",
          right: "20px",
          width: "67px",
          height: "63px",
          borderRadius: "8px",
          boxShadow: "inset 0 2px 6px rgba(0,0,0,0.6)",
          fontSize: "50px",
        }}
      >
        🎓
      </div>

      {/* BOTTOM BOX */}
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 bg-[#65cfad] text-white flex items-center justify-center"
        style={{
          width: "370px",
          height: "80px",
          borderTopLeftRadius: 0,
          borderTopRightRadius: 0,
          borderBottomLeftRadius: "12px",
          borderBottomRightRadius: "12px",
        }}
      >
        <span className="w-full text-center break-words max-w-[300px]">
          <b>{title}</b>
        </span>
      </div>
    </div>
  );
}
