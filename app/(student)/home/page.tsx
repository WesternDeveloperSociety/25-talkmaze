"use client";

import React, { useEffect, useState } from "react";
import LessonProgressBar from "../components/LessonProgressBar";
import TokenBar from "../components/TokensBar";
import ReviewLessonCard from "../components/ReviewLesson";
import NextLessonCard from "../components/UpNextLesson";
import ScheduleList from "../components/ScheduleList";
import { getProgress } from "./actions";
import { Appointment } from "../types/lesson";

interface ProgressData {
  current: number;
  total: number;
}



export default function Home() {
  const [progress, setProgress] = useState<ProgressData>({ current: 0, total: 24 });
  const [studentId, setStudentId] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<Appointment[]>([]);

  /*
  useEffect(() => {
    
    async function fetchData() {
      try {
        // Fetch Progress
        const progressRes = await getProgress()


        if (progressRes.ok) {
          const data = await progressRes.json();
          setProgress({
            current: typeof data.completed === 'number' ? data.completed : 8,
            total: typeof data.total === 'number' ? data.total : 24
          });
          if (data.studentId) {
            setStudentId(data.studentId);
          }
        }

        // Fetch Schedule (Lessons)
        /*
        const lessonsRes = await fetch("/api/teachworks/lessons");
        if (lessonsRes.ok) {
            const lessonsData = await lessonsRes.json();
            if (Array.isArray(lessonsData)) {
                const mapped: Appointment[] = lessonsData.map((item: any) => ({
                    id: String(item.id),
                    title: item.name,
                    start_date: item.from_datetime,
                    end_date: item.to_datetime,
                }));
                setSchedule(mapped);
            }
        }
            

      } catch (e) {
        console.error("Failed to fetch data", e);
      }
    }
    fetchData();
  }, []);
  */

  const nextLesson = schedule.length > 0 ? schedule[0] : null;

  return (
    <div
      className=" w-full p-8 mx-auto"
    >

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_auto] gap-8 w-full">


        <div className="flex flex-col gap-8 w-full">


          <LessonProgressBar current={progress.current} total={progress.total} />


          <div className="w-full h-[300px] rounded-2xl bg-[#2B4257]/20 border-2 border-dashed border-[#2B4257]/40 flex items-center justify-center text-[#B1E7D6]">
            Video Component Area
          </div>

            {/* 3. Bottom Row: Review & Up Next Cards */}
          <div className="grid w-full gap-6 sm:gap-8 grid-cols-1 lg:grid-cols-2">
              {/* Review Lesson Card */}
              <ReviewLessonCard 
                lessonNumber={7} 
                title="Overcoming Nerves" 
              />
              
              {/* Up Next Lesson Card */}
              <NextLessonCard 
                lessonNumber={9}
                title="Speech Blocking"
              />
            </div>
        </div>


        <div className="flex flex-col gap-8">
          <TokenBar />


          <ScheduleList schedule={schedule} />
        </div>

      </div>
    </div>
  );
}
