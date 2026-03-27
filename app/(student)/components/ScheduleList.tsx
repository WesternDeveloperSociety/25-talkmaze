"use client";

import React, { useState } from "react";
import { Appointment } from "../types/lesson";
import LessonDetailModal from "./LessonDetailModal";

export default function ScheduleList({ schedule }: { schedule: Appointment[] }) {
    const [selectedLesson, setSelectedLesson] = useState<Appointment | null>(null);

    if (schedule.length === 0) {
        return (
            <div className="w-[100%] h-[300px] rounded-2xl bg-white border border-gray-100 flex items-center justify-center text-gray-400">
                No upcoming lessons.
            </div>
        );
    }

    return (
        <div className="w-full flex flex-col gap-4">
            <h3 className="text-xl font-bold text-[#2B4257]">Upcoming Lessons</h3>
            <div className="flex flex-col gap-3">
                {schedule.slice(0, 3).map((item) => {
                    const startDate = new Date(item.start_date);
                    const dateStr = startDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                    const timeStr = startDate.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

                    return (
                        <div
                            key={item.id}
                            onClick={() => setSelectedLesson(item)}
                            className="block group cursor-pointer"
                        >
                            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow flex justify-between items-center">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <div className="font-semibold text-[#2B4257] group-hover:text-[#65CFAD] transition-colors">
                                            {item.title}
                                        </div>
                                        {item.studentName && (
                                            <span className="text-[10px] bg-[#B1E7D6] text-[#2B4257] px-2 py-0.5 rounded-full font-bold uppercase">
                                                {item.studentName}
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-sm text-gray-500">
                                        {dateStr} • {timeStr}
                                    </div>
                                </div>
                                <div className="w-8 h-8 rounded-full bg-[#f0f9f6] flex items-center justify-center text-[#2B4257] group-hover:bg-[#B1E7D6] transition-colors">
                                    →
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {selectedLesson && (
                <LessonDetailModal 
                    lesson={selectedLesson} 
                    onClose={() => setSelectedLesson(null)} 
                />
            )}
        </div>
    );
}
