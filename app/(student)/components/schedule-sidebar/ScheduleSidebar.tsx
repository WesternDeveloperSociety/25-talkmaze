"use client";
import React, { useState } from "react";
import UpcomingLessonsList from "./UpcomingLessonsList";
import AvailableTimeSlotsList from "./AvailableTimeSlotsList";
import { usePathname } from "next/navigation";


type Lesson = {
    id: string;
    title: string;
    starts_at: Date;
};

type TimeSlot = {
    id: string;
    date: Date;
    coach: string;
};

type ScheduleSidebarProps = {
    sideBarHeading: string;
    upcomingLessons: Lesson[];
};

const ScheduleSidebar = ({ sideBarHeading, upcomingLessons }: ScheduleSidebarProps) => {
    const pathname = usePathname();

    const isCalendarPage = pathname === "/calendar";



    const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);

    const [selectedTimeSlotId, setSelectedTimeSlotId] = useState<string | null>(
        null
    );

    const [showTimeSlots, setShowTimeSlots] = useState(false);
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [confirmedTimeSlot, setConfirmedTimeSlot] = useState<TimeSlot | null>(
        null
    );


    const availableTimeSlots: TimeSlot[] = [
        {
            id: "1",
            date: new Date("2024-05-06T15:00:00"),
            coach: "Coach John",
        },
        {
            id: "2",
            date: new Date("2024-05-07T15:00:00"),
            coach: "Coach Sarah",
        },
        {
            id: "3",
            date: new Date("2024-05-08T15:00:00"),
            coach: "Coach Mike",
        },
        {
            id: "4",
            date: new Date("2024-05-09T15:00:00"),
            coach: "Coach Emily",
        },
        {
            id: "5",
            date: new Date("2024-05-10T15:00:00"),
            coach: "Coach Anna",
        },
    ];


    const handleSelectLesson = (id: string) => {
        setSelectedLessonId((prevId) => (prevId === id ? null : id));
        setShowTimeSlots(false);
        setSelectedTimeSlotId(null);
        setShowConfirmation(false);
    };

    const handleSelectTimeSlot = (id: string) => {
        setSelectedTimeSlotId((prevId) => (prevId === id ? null : id));
    };


    const handleReschedule = () => {

        if (selectedLessonId !== null && !showTimeSlots) {
            setShowTimeSlots(true);
        } else if (selectedTimeSlotId !== null) {


            const timeSlot = availableTimeSlots.find(
                (slot) => slot.id === selectedTimeSlotId
            );


            if (timeSlot) {
                setConfirmedTimeSlot(timeSlot);
                setShowTimeSlots(false);
                setShowConfirmation(true);

                console.log(
                    `Rescheduling lesson ${selectedLessonId} to timeSlot ${selectedTimeSlotId}`
                );
            }
        }
    };


    const handleCloseMenu = () => {
        setShowTimeSlots(false);
        setSelectedTimeSlotId(null);
    };



    const handleOkay = () => {
        setShowConfirmation(false);
        setSelectedLessonId(null);
        setSelectedTimeSlotId(null);
        setConfirmedTimeSlot(null);
    };



    const formatConfirmationDate = (date: Date) => {
        const options: Intl.DateTimeFormatOptions = {
            weekday: "long",
            month: "long",
            day: "numeric",
        };
        return date.toLocaleDateString("en-US", options);
    };


    const formatConfirmationTime = (date: Date) => {
        return date.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
        });
    };


    return (
        <div
            className={`w-full h-full p-5 rounded-[20px] flex flex-col ${showConfirmation
                ? "bg-[#1F2E3B] border-[5px] border-[#B1E7D6]"
                : "bg-[#B1E7D6]"
                }`}
        >

            {!showConfirmation && !showTimeSlots && (
                <>
                    <h1 className="mb-5 text-[#1F2E3B] font-semibold">
                        {sideBarHeading}
                    </h1>


                    <UpcomingLessonsList
                        lessons={upcomingLessons}
                        selectedLessonId={selectedLessonId}
                        onSelectLesson={handleSelectLesson}
                    />


                    {isCalendarPage && (
                        <div className="flex justify-end">
                            <button
                                onClick={handleReschedule}
                                className={`w-40 h-[38px] mt-8 mb-4 rounded-lg font-semibold ${selectedLessonId !== null
                                    ? "bg-[#1F2E3B] text-[#B1E7D6] cursor-pointer"
                                    : "bg-[#65CFAD]"
                                    }`}
                                disabled={selectedLessonId === null}
                            >
                                Reschedule
                            </button>
                        </div>
                    )}
                </>
            )}


            {!showConfirmation && showTimeSlots && (
                <>
                    <h1 className="mb-5 text-[#1F2E3B] font-semibold">
                        Choose a New Time
                    </h1>


                    <AvailableTimeSlotsList
                        timeSlots={availableTimeSlots}
                        selectedLessonTitle={
                            upcomingLessons.find((lesson) => lesson.id === selectedLessonId)
                                ?.title || ""
                        }
                        selectedTimeSlotId={selectedTimeSlotId}
                        onSelectTimeSlot={handleSelectTimeSlot}
                    />


                    {isCalendarPage && (
                        <div className="flex justify-between gap-3">

                            <button
                                onClick={handleCloseMenu}
                                className="w-40 h-[38px] mt-8 mb-4 rounded-lg bg-[#1F2E3B] text-[#B1E7D6] font-semibold cursor-pointer"
                            >
                                Close Menu
                            </button>

                            <button
                                onClick={handleReschedule}
                                className={`w-40 h-[38px] mt-8 mb-4 rounded-lg font-semibold ${selectedTimeSlotId !== null
                                    ? "bg-[#1F2E3B] text-[#B1E7D6] cursor-pointer"
                                    : "bg-[#65CFAD] text-[#1F2E3B]"
                                    }`}
                                disabled={selectedTimeSlotId === null}
                            >
                                Confirm
                            </button>
                        </div>
                    )}
                </>
            )}


            {showConfirmation && confirmedTimeSlot && (
                <>
                    <div className="flex-1 flex flex-col items-center justify-center">
                        <div className="text-center">
                            <h2 className="text-[#65CFAD] font-semibold text-lg mb-6">
                                Confirmation:
                            </h2>
                            <p className="text-[#65CFAD] font-semibold mb-2">
                                {formatConfirmationDate(confirmedTimeSlot.date)}
                            </p>
                            <p className="text-[#65CFAD] font-semibold mb-2">
                                {upcomingLessons.find(
                                    (lesson) => lesson.id === selectedLessonId
                                )?.title || ""}
                            </p>
                            <p className="text-[#65CFAD] font-semibold">
                                {formatConfirmationTime(confirmedTimeSlot.date)}
                            </p>
                        </div>
                    </div>


                    {isCalendarPage && (
                        <div className="flex justify-center">
                            <button
                                onClick={handleOkay}
                                className="w-40 h-[38px] mb-4 rounded-lg bg-[#65CFAD] text-[#1F2E3B] font-semibold cursor-pointer"
                            >
                                Okay
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default ScheduleSidebar;
