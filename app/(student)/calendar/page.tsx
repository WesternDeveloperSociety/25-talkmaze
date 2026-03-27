"use client";

import { useEffect, useState } from "react";
import Calendar from "../components/calendar/Calendar";
import ScheduleSidebar from "../components/schedule-sidebar/ScheduleSidebar";


type Lesson = {
    id: string;
    title: string;
    starts_at: Date;
};




const CalendarPage = () => {
    const [upcomingLessons, setUpcomingLessons] = useState<Lesson[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchSchedule() {
            try {
                setLoading(true);

                const res = await fetch(`/api/teachworks/lessons`);

                if (!res.ok) {
                    console.error("Failed to load schedule");
                    setUpcomingLessons([]);
                    return;
                }

                const data = await res.json();

                if (Array.isArray(data)) {
                    // Map TeachworksLesson format to component Lesson state
                    const mappedLessons: Lesson[] = data.map((item: any) => ({
                        id: String(item.id),
                        title: item.name,
                        starts_at: new Date(item.from_datetime), // Use ISO datetime
                    }));
                    setUpcomingLessons(mappedLessons);
                } else {
                    setUpcomingLessons([]);
                }
            } catch (err) {
                console.error("Error loading schedule:", err);
            } finally {
                setLoading(false);
            }
        }

        fetchSchedule();
    }, []);


    return (
        <div className="flex h-full mr-10 mb-6 bg-[#1F2E3B] shadow-[inset_0_4px_10px_rgba(0,0,0,0.6)] rounded-xl">
            <div className="w-full mt-[106px] ml-6 flex justify-evenly">

                <div className="w-[668px]">
                    <Calendar />
                </div>

                <div className="w-[402px] h-[592px]">
                    {loading ? (
                        <div className="w-full h-full flex items-center justify-center text-[#B1E7D6]">
                            Loading Schedule...
                        </div>
                    ) : (
                        <ScheduleSidebar
                            sideBarHeading="Upcoming Lessons"
                            upcomingLessons={upcomingLessons}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default CalendarPage;
