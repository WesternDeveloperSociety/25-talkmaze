"use client";

import React from "react";
import { Appointment } from "../types/lesson";

interface LessonDetailModalProps {
    lesson: Appointment;
    onClose: () => void;
}

export default function LessonDetailModal({ lesson, onClose }: LessonDetailModalProps) {
    const startDate = new Date(lesson.start_date);
    const endDate = new Date(lesson.end_date);
    
    const dateStr = startDate.toLocaleDateString(undefined, { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
    
    const timeStr = `${startDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} - ${endDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#1f2e3b]/80 backdrop-blur-sm">
            <div 
                className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="bg-[#B1E7D6] p-6 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-[#2B4257]">{lesson.title}</h2>
                    <button 
                        onClick={onClose}
                        className="text-[#2B4257] hover:opacity-70 transition-opacity text-2xl font-bold"
                    >
                        ×
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 flex flex-col gap-5">
                    <div className="flex flex-col gap-1">
                        <label className="text-sm font-semibold text-[#2B4257]/60">Student</label>
                        <p className="text-lg font-bold text-[#2B4257]">{lesson.studentName}</p>
                    </div>

                    {lesson.coachName && (
                        <div className="flex flex-col gap-1">
                            <label className="text-sm font-semibold text-[#2B4257]/60">Coach</label>
                            <p className="text-lg text-[#2B4257] font-medium">{lesson.coachName}</p>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1">
                            <label className="text-sm font-semibold text-[#2B4257]/60">Date</label>
                            <p className="text-[#2B4257]">{dateStr}</p>
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-sm font-semibold text-[#2B4257]/60">Time</label>
                            <p className="text-[#2B4257] font-bold">{timeStr}</p>
                        </div>
                    </div>

                    {lesson.description && (
                         <div className="flex flex-col gap-1">
                             <label className="text-sm font-semibold text-[#2B4257]/60">Meeting Description</label>
                             <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                 <p className="text-[#2B4257] text-sm whitespace-pre-wrap">{lesson.description}</p>
                             </div>
                         </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 pt-0 flex flex-col gap-3">
                    <button 
                        onClick={onClose}
                        className="w-full py-3 bg-[#2B4257] text-white font-bold rounded-xl hover:opacity-90 transition-opacity"
                    >
                        Close
                    </button>
                </div>
            </div>
            
            {/* Backdrop click to close */}
            <div className="absolute inset-0 -z-10" onClick={onClose}></div>
        </div>
    );
}
