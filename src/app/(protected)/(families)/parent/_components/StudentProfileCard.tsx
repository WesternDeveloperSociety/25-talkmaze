"use client";

import { EditIcon, LocationPinFilledIcon } from "@/src/components/ui/icons";
import { Card } from "@/src/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/src/components/ui/avatar";
import { initials } from "@/src/utils/formatName";

interface StudentProfileCardProps {
  name: string;
  location: string;
  dob: string;
  grade: string | number;
  description: string;
  imageUrl?: string;
  onNext?: () => void;
  onPrev?: () => void;
  currentIndex?: number;
  totalStudents?: number;
}

/**
 * Displays the profile details (notes, DOB, etc.) of the selected student
 */
export default function StudentProfileCard({
  name = "Priya",
  location = "Location",
  dob = "April 11, 2016",
  grade = "3",
  description = "Sweet and outgoing personality",
  imageUrl,
  onNext,
  onPrev,
  currentIndex = 0,
  totalStudents = 1,
}: StudentProfileCardProps) {
  return (
    <Card
      variant="accent"
      shadow="md"
      padding="none"
      className="rounded-2xl overflow-hidden relative h-full"
      style={{
        backgroundImage:
          "url('/images/backgrounds/student-profile-card-bg.png')",
        backgroundSize: "cover",
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* Green header bar */}
      <div className="bg-[#65CFAD] min-h-[51px] w-full flex items-center justify-between gap-2 px-4 absolute top-0 left-0 right-0 z-10 py-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0">
          <h2
            className="font-bold text-[#1F2E3B] text-base sm:text-lg md:text-[22px] leading-none"
            style={{ fontFamily: "Inter, sans-serif" }}
          >
            TalkMaze Student {totalStudents > 1 ? "Profiles" : "Profile"}
          </h2>
          {totalStudents > 1 && (
            <div className="flex items-center gap-1.5 bg-[#1F2E3B]/10 px-2 py-1 rounded-full shrink-0">
              <button
                onClick={onPrev}
                aria-label="Previous student"
                className="w-5 h-5 rounded-full bg-[#1F2E3B] text-white flex items-center justify-center hover:bg-[#2B4257] transition-all active:scale-95"
              >
                <ChevronLeftIcon />
              </button>
              <span className="text-[11px] font-bold text-[#1F2E3B] leading-none -mb-px">
                {currentIndex + 1} / {totalStudents}
              </span>
              <button
                onClick={onNext}
                aria-label="Next student"
                className="w-5 h-5 rounded-full bg-[#1F2E3B] text-white flex items-center justify-center hover:bg-[#2B4257] transition-all active:scale-95"
              >
                <ChevronRightIcon />
              </button>
            </div>
          )}
        </div>
        <button
          className="bg-[#1F2E3B] text-white text-[10px] font-semibold px-3 py-1 rounded flex items-center gap-1 shrink-0"
          style={{ borderRadius: "5px" }}
        >
          <EditIcon />
          EDIT
        </button>
      </div>

      {/* Avatar — overlaps header */}
      <div className="absolute left-4 sm:left-6 top-[74px] z-20 flex flex-col items-center">
        <Avatar
          variant="navy"
          className="size-24 sm:size-30 xl:size-38.25 text-white"
        >
          <AvatarImage src={imageUrl} alt={name} sizes="153px" />
          <AvatarFallback className="text-5xl font-bold">
            {initials(name)}
          </AvatarFallback>
        </Avatar>
        <p
          className="text-[#2E2E2E] font-semibold text-[20px] mt-1 whitespace-nowrap"
          style={{ fontFamily: "Roboto, sans-serif" }}
        >
          {name}
        </p>
      </div>

      {/* Right info section */}
      <div className="absolute left-[120px] sm:left-[148px] xl:left-[197px] right-4 top-[60px] bottom-4 flex flex-col">
        {/* Location */}
        <div className="flex items-center gap-1 my-1">
          <LocationPinFilledIcon />
          <span
            className="text-[#2B4257] font-semibold text-[12px]"
            style={{ fontFamily: "Roboto, sans-serif" }}
          >
            {location}
          </span>
        </div>

        {/* Divider */}
        <div className="border-t border-[#1F2E3B]/20 w-full" />

        {/* Date of Birth / Grade */}
        <div className="flex my-2 pl-4 gap-7">
          <div
            className="flex flex-col gap-1 text-black/40 font-semibold text-[16px]"
            style={{ fontFamily: "Roboto, sans-serif" }}
          >
            <span>Date of Birth</span>
            <span>Grade</span>
          </div>
          <div
            className="flex flex-col gap-1 text-[#1F2E3B] font-semibold text-[16px]"
            style={{ fontFamily: "Roboto, sans-serif" }}
          >
            <span>{dob}</span>
            <span>{grade}</span>
          </div>
        </div>

        {/* Personality bio box */}
        <div
          className="bg-white rounded-xl p-3 text-[#1F2E3B] text-[14px] italic leading-snug shadow-[inset_0_3px_3.3px_rgba(0,0,0,0.25)] flex-1"
          style={{ fontFamily: "Roboto, sans-serif" }}
        >
          <p>{description}</p>
        </div>
      </div>
    </Card>
  );
}

function ChevronLeftIcon() {
  return (
    <svg width="6" height="10" viewBox="0 0 6 10" fill="none">
      <path
        d="M5 1L1 5L5 9"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="6" height="10" viewBox="0 0 6 10" fill="none">
      <path
        d="M1 1L5 5L1 9"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
