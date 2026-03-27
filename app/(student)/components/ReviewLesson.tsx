"use client";

import React from "react";

interface ReviewLessonCardProps {
  lessonNumber?: number;
  title?: string;
  imageUrl?: string;
}

export default function ReviewLessonCard({
  lessonNumber = 7,
  title = "Overcoming Nerves",
  imageUrl = "https://placehold.co/353x244" // Default placeholder from Figma
}: ReviewLessonCardProps) {
  return (
    /* Main Card Container
      - Dimensions: 353px x 244px
      - Background: #B1E7D6 (talkmaze_green_light)
      - Rounded: 12px
    */
    <div
      className="relative rounded-[12px] shadow-[0px_4px_4px_rgba(0,0,0,0.25)] overflow-hidden shrink-0 group cursor-pointer"
      style={{
        width: "100%",
        height: "171px",
        backgroundColor: "var(--talkmaze_green_light, #B1E7D6)",
        // Using a background image with a blend or fallback if needed
        backgroundImage: `url(${imageUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* Top Left Label: "Review: Lesson X" 
        - White container with inner shadow
      */}
      <div 
        className="absolute left-[18px] top-[15px] w-[145px] h-[35px]"
      >
        <div className="w-full h-full bg-white rounded-[12px] shadow-[inset_0px_4px_4px_rgba(0,0,0,0.25)] flex items-center justify-center">
            <span 
              className="text-center"
              style={{
                color: "var(--Dark-Navy, #1F2E3B)",
                fontSize: "16px",
                fontFamily: "Roboto, sans-serif",
                fontWeight: 600,
              }}
            >
              Review: Lesson {lessonNumber}
            </span>
        </div>
      </div>

      {/* Top Right Icon Box 
        - White container with inner shadow
        - Contains the Seashell CSS drawing
      */}
      <div 
        className="absolute left-[263px] top-[15px] w-[67px] h-[63px] bg-white rounded-[12px] shadow-[inset_0px_4px_4px_rgba(0,0,0,0.25)] overflow-hidden"
      >
        {/* Seashell CSS Drawing (Scaled/Positioned from Figma) */}
        <div 
          className="absolute left-[7px] top-[5px] w-[53px] h-[53px]"
          data-token="seashell"
        >
          {/* Main Shell Body */}
          <div 
            className="absolute left-[0.62px] top-[1.12px] w-[51.76px] h-[50.75px] bg-[#ACBBBA]" 
          />
          {/* Inner Spiral */}
          <div 
            className="absolute left-[6.46px] top-[6.31px] w-[41.08px] h-[41.06px] bg-[#819A97]" 
          />
          {/* Shell Detail/Shadow */}
          <div 
            className="absolute left-[38.16px] top-[23.66px] w-[9.01px] h-[12.65px] bg-[#6F7F7D]" 
          />
        </div>
      </div>

      {/* Bottom Title Bar
        - Dimensions: 353px x 80px
        - Position: Top 164px (Aligns to bottom)
        - Color: #65CFAD
      */}
      <div 
        className="absolute left-0 top-[114.8px] w-[100%] h-[56px] bg-[#65CFAD] flex items-start justify-center pt-[16px]"
      >
        <span
          className="text-center"
          style={{
            color: "white",
            fontSize: "20px",
            fontFamily: "Roboto, sans-serif",
            fontWeight: 600,
          }}
        >
          {title}
        </span>
      </div>
    </div>
  );
}