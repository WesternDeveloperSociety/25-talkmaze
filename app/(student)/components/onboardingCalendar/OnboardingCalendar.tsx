"use client";
import { useState } from "react";
import { Roboto, Inter } from "next/font/google";

const roboto = Roboto({
  weight: ["300", "400", "500", "700"],
  subsets: ["latin"],
});

const inter = Inter({
  weight: ["700"],
  subsets: ["latin"],
});

interface CalendarProps {
  selectedDates: Date[];
  onDateSelect: (date: Date | null) => void;
}

export default function Calendar({ selectedDates, onDateSelect }: CalendarProps) {
  const daysOfWeek = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  const monthsOfYear = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  const currentDate = new Date();
  const [currentMonth, setCurrentMonth] = useState(currentDate.getMonth());
  const [currentYear, setCurrentYear] = useState(currentDate.getFullYear());

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
  const lastDayOfPrevMonth = new Date(currentYear, currentMonth, 0).getDate();
  const lastDayOfWeek = new Date(currentYear, currentMonth, daysInMonth).getDay();
  const emptySpacesNextMonth = 6 - lastDayOfWeek;

  const prevMonth = () => {
    setCurrentMonth((m) => {
      if (m === 0) { setCurrentYear((y) => y - 1); return 11; }
      return m - 1;
    });
  };

  const nextMonth = () => {
    setCurrentMonth((m) => {
      if (m === 11) { setCurrentYear((y) => y + 1); return 0; }
      return m + 1;
    });
  };

  const isSelected = (y: number, m: number, d: number) =>
    selectedDates.some(
      (date) =>
        date.getFullYear() === y &&
        date.getMonth() === m &&
        date.getDate() === d
    );

  const handleClick = (y: number, m: number, d: number) => {
    onDateSelect(new Date(y, m, d));
  };

  return (
    <div className="w-full">
      {/* Calendar Month/Year Heading */}
      <div className="w-full mb-2 rounded-[20px] bg-[#B1E7D6] h-16 flex items-center justify-between px-4">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#1F2E3B" className="size-6 cursor-pointer" onClick={prevMonth}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
        </svg>
        <h2 className={`${roboto.className} text-[2rem] font-bold text-[#1F2E3B]`}>
          {monthsOfYear[currentMonth]} {currentYear}
        </h2>
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#1F2E3B" className="size-6 cursor-pointer" onClick={nextMonth}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
        </svg>
      </div>
      {/* Days of Week Header */}
      <div className="w-full mb-2 flex justify-between">
        {daysOfWeek.map((day) => (
          <span key={day} className={`${inter.className} flex w-20 h-20 items-center justify-center text-[22px] font-bold bg-[#65CFAD] rounded-xl`}>
            {day}
          </span>
        ))}
      </div>
      {/* Calendar Days Grid */}
      <div className="w-full mb-2 grid gap-y-2 justify-between grid-cols-[repeat(7,max-content)]">
        {/* Previous month days */}
        {[...Array(firstDayOfMonth).keys()].map((_, index) => {
          const prevMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
          const prevMonthIndex = currentMonth === 0 ? 11 : currentMonth - 1;
          const prevDay = lastDayOfPrevMonth - (firstDayOfMonth - index - 1);
          return (
            <span key={`prev-${index}`}
              className={`${inter.className} flex w-20 h-20 items-center justify-center text-[22px] font-bold rounded-xl shadow-[inset_0_4px_4px_rgba(0,0,0,0.25)] cursor-pointer ${
                isSelected(prevMonthYear, prevMonthIndex, prevDay) ? "bg-[#B1E7D6] text-[#142535]" : "bg-[#142535] text-[#65CFAD]"
              }`}
              onClick={() => handleClick(prevMonthYear, prevMonthIndex, prevDay)}
            >
              {prevDay}
            </span>
          );
        })}
        {/* Current month days */}
        {[...Array(daysInMonth).keys()].map((day) => {
          const dayNum = day + 1;
          const isToday = currentYear === currentDate.getFullYear() && currentMonth === currentDate.getMonth() && dayNum === currentDate.getDate();
          return (
            <span key={dayNum}
              className={`${inter.className} relative flex w-20 h-20 items-center justify-center text-[22px] font-bold rounded-xl shadow-[inset_0_4px_4px_rgba(0,0,0,0.25)] cursor-pointer ${
                isSelected(currentYear, currentMonth, dayNum) ? "bg-[#B1E7D6] text-[#142535]" : "bg-[#142535] text-[#65CFAD]"
              }`}
              onClick={() => handleClick(currentYear, currentMonth, dayNum)}
            >
              {dayNum}
              {isToday && (
                <span className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[#65CFAD]" />
              )}
            </span>
          );
        })}
        {/* Next month days */}
        {[...Array(emptySpacesNextMonth).keys()].map((_, index) => {
          const nextMonthYear = currentMonth === 11 ? currentYear + 1 : currentYear;
          const nextMonthIndex = currentMonth === 11 ? 0 : currentMonth + 1;
          const nextDay = index + 1;
          return (
            <span key={`next-${index}`}
              className={`${inter.className} flex w-20 h-20 items-center justify-center text-[22px] font-bold rounded-xl shadow-[inset_0_4px_4px_rgba(0,0,0,0.25)] cursor-pointer ${
                isSelected(nextMonthYear, nextMonthIndex, nextDay) ? "bg-[#B1E7D6] text-[#142535]" : "bg-[#142535] text-[#65CFAD]"
              }`}
              onClick={() => handleClick(nextMonthYear, nextMonthIndex, nextDay)}
            >
              {nextDay}
            </span>
          );
        })}
      </div>
    </div>
  );
}