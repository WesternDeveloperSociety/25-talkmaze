"use client";
import { useState } from "react";
import { Roboto, Inter } from "next/font/google";

// Fonts imported from next/font
const roboto = Roboto({
  weight: ["300", "400", "500", "700"],
  subsets: ["latin"],
});

const inter = Inter({
  weight: ["700"],
  subsets: ["latin"],
});

// Calendar component
export default function Calendar() {
  const daysOfWeek = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  const monthsOfYear = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  // Get current date on the local machine
  const currentDate = new Date();
  const [currentMonth, setCurrentMonth] = useState(currentDate.getMonth());
  const [currentYear, setCurrentYear] = useState(currentDate.getFullYear());
  const [selected, setSelected] = useState<Date | null>(null);

  // Get last day of the current month
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  // Get the weekday of first day of current month
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();

  // Get last day of previous month
  const lastDayOfPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

  // Get the weekday of the last day of the current month
  const lastDayOfWeek = new Date(
    currentYear,
    currentMonth,
    daysInMonth
  ).getDay();

  // Calculate the number of empty spaces needed
  const emptySpacesNextMonth = 6 - lastDayOfWeek;

  // Functions to trigger the re-rendering of calendar UI when navigating between months
  const prevMonth = () => {
    setCurrentMonth((m) => {
      if (m === 0) {
        setCurrentYear((y) => y - 1);
        return 11;
      }
      return m - 1;
    });
  };

  const nextMonth = () => {
    setCurrentMonth((m) => {
      if (m === 11) {
        setCurrentYear((y) => y + 1);
        return 0;
      }
      return m + 1;
    });
  };

  // Function to handle date selection
  const handleSelect = (y: number, m: number, d: number) => {
    const picked = new Date(y, m, d);
    
    // Check if the clicked date is already selected
    if (isSelected(y, m, d)) {
      setSelected(null); // Unselect
    } else {
      setSelected(picked);
      
      // Log the selected date for debugging
      // For now selecting a date on the Calendar does nothing other than
      // indicate that it has been selected
      const year = picked.getFullYear();
      const month = String(picked.getMonth() + 1).padStart(2, "0");
      const day = String(picked.getDate()).padStart(2, "0");
      console.log(`Clicked date -> Year: ${year}, Month: ${month}, Day: ${day}`);
    }
  };

  const isSelected = (y: number, m: number, d: number) =>
    selected &&
    selected.getFullYear() === y &&
    selected.getMonth() === m &&
    selected.getDate() === d;

  return (
    <div className="w-full">
      {/* Calendar Month/Year Heading */}
      <div className="w-full mb-2 rounded-[20px] bg-[#B1E7D6] h-16 flex items-center justify-between px-4">
        {/* Button to go to prev month */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="#1F2E3B"
          className="size-6 cursor-pointer"
          onClick={prevMonth}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15.75 19.5 8.25 12l7.5-7.5"
          />
        </svg>
        <h2
          className={`${roboto.className} text-[2rem] font-bold text-[#1F2E3B]`}
        >
          {monthsOfYear[currentMonth]} {currentYear}
        </h2>
        {/* Button to go to next month */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="#1F2E3B"
          className="size-6 cursor-pointer"
          onClick={nextMonth}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m8.25 4.5 7.5 7.5-7.5 7.5"
          />
        </svg>
      </div>
      {/* Day of the Week Heading (Sun, Mon, ..., Sat) */}
      <div className="w-full mb-2 flex justify-between">
        {daysOfWeek.map((day) => (
          <span
            key={day}
            className={`${inter.className} flex w-20 h-20 items-center justify-center text-[22px] font-bold bg-[#65CFAD] rounded-xl`}
          >
            {day}
          </span>
        ))}
      </div>
      {/* Calender Numeric Days of the Month */}
      <div className="w-full mb-2 grid gap-y-2 justify-between grid-cols-[repeat(7,max-content)]">
        {/* Dynamically generate days of previous month */}
        {[...Array(firstDayOfMonth).keys()].map((_, index) => {
          const prevMonthYear =
            currentMonth === 0 ? currentYear - 1 : currentYear;
          const prevMonthIndex = currentMonth === 0 ? 11 : currentMonth - 1;
          const prevDay = lastDayOfPrevMonth - (firstDayOfMonth - index - 1);

          return (
            <span
              key={`empty-${index}`}
              className={`${inter.className} flex w-20 h-20 items-center justify-center text-[22px] font-bold rounded-xl shadow-[inset_0_4px_4px_rgba(0,0,0,0.25)] cursor-pointer ${
                isSelected(prevMonthYear, prevMonthIndex, prevDay)
                  ? "bg-[#B1E7D6] text-[#142535]"
                  : "bg-[#142535] text-[#65CFAD]"
              }`}
              onClick={() =>
                handleSelect(prevMonthYear, prevMonthIndex, prevDay)
              }
            >
              {prevDay}
            </span>
          );
        })}
        {/* Dynamically generate days of current month */}
        {[...Array(daysInMonth).keys()].map((day) => {
          const dayNum = day + 1;
          const isToday =
            currentYear === currentDate.getFullYear() &&
            currentMonth === currentDate.getMonth() &&
            dayNum === currentDate.getDate();

          return (
            <span
              key={dayNum}
              className={`${inter.className} relative flex w-20 h-20 items-center justify-center text-[22px] font-bold rounded-xl shadow-[inset_0_4px_4px_rgba(0,0,0,0.25)] cursor-pointer ${
                isSelected(currentYear, currentMonth, dayNum)
                  ? "bg-[#B1E7D6] text-[#142535]"
                  : "bg-[#142535] text-[#65CFAD]"
              }`}
              onClick={() => handleSelect(currentYear, currentMonth, dayNum)}
            >
              {dayNum}
              {/* Render dot under the current day on calendar */}
              {isToday && (
                <span className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[#65CFAD]" />
              )}
            </span>
          );
        })}
        {/* Dynamically generate days of next month */}
        {[...Array(emptySpacesNextMonth).keys()].map((_, index) => {
          const nextMonthYear =
            currentMonth === 11 ? currentYear + 1 : currentYear;
          const nextMonthIndex = currentMonth === 11 ? 0 : currentMonth + 1;
          const nextDay = index + 1;

          return (
            <span
              key={`next-${index}`}
              className={`${inter.className} flex w-20 h-20 items-center justify-center text-[22px] font-bold rounded-xl shadow-[inset_0_4px_4px_rgba(0,0,0,0.25)] cursor-pointer ${
                isSelected(nextMonthYear, nextMonthIndex, nextDay)
                  ? "bg-[#B1E7D6] text-[#142535]"
                  : "bg-[#142535] text-[#65CFAD]"
              }`}
              onClick={() =>
                handleSelect(nextMonthYear, nextMonthIndex, nextDay)
              }
            >
              {nextDay}
            </span>
          );
        })}
      </div>
    </div>
  );
}
