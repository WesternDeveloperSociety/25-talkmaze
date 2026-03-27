"use client";

import React from "react";

export default function TokenBar() {
  return (
    /* 
       Main Container:
       - Fixed Dimensions: 402px x 147px
       - This ensures the outline and shape are always correct.
    */
    <div
      className="relative bg-white rounded-[12px] shadow-[0px_4px_4px_rgba(0,0,0,0.25)] box-border overflow-visible"
      style={{
        width: "402px",
        height: "147px",
        flexShrink: 0,
        outline: "7px solid var(--talkmaze_green_light, #B1E7D6)",
        outlineOffset: "-7px",
      }}
    >
      {/* Title - Positioned Absolutely relative to this card */}
      <div
        className="absolute left-[16px] top-[20px]"
        style={{
          color: "var(--talkmaze_turquoise, #2B4257)",
          fontSize: "16px",
          fontFamily: "Roboto, sans-serif",
          fontWeight: 600,
        }}
      >
        Tokens
      </div>

      {/* 
         Icons Row Container 
         - Positioned at left:37px, top:66px as per Figma
         - Uses Flex to handle the gap between icons easily
      */}
      <div 
        className="absolute left-[37px] top-[66px] flex items-start justify-start gap-[16px]"
      >
        
        {/* --- ICON DRAWINGS START --- */}
        
        {/* COMPASS */}
        <div data-token="compass" className="relative w-[33px] h-[33px] overflow-hidden shrink-0">
          <div className="absolute left-[25.46px] top-[1.03px] w-[6.5px] h-[6.5px] bg-[#E2A610]" />
          <div className="absolute left-[25.02px] top-[3.97px] w-[4px] h-[4.01px] bg-[#FFCA28]" />
          <div className="absolute left-[25.02px] top-[5.17px] w-[2.81px] h-[2.81px] bg-[#E2A610]" />
          <div className="absolute left-[1.04px] top-[1.87px] w-[30.08px] h-[30.1px] bg-[#FFCA28]" />
          <div className="absolute left-[3.89px] top-[4.72px] w-[24.38px] h-[24.4px] bg-white" />
          <div className="absolute left-[7.29px] top-[8.12px] w-[17.59px] h-[17.6px] bg-[#E0C3AB]" />
          <div className="absolute left-[9.86px] top-[10.7px] w-[12.44px] h-[12.44px] bg-[#B2947C]" />
          <div className="absolute left-[9.39px] top-[10.43px] w-[13.8px] h-[13.88px] bg-[#212121] opacity-30" />
          <div className="absolute left-[14.62px] top-[10.04px] w-[8.34px] h-[8.34px] bg-[#F44336]" />
          <div className="absolute left-[9.03px] top-[15.64px] w-[8.34px] h-[8.34px] bg-[#2F7889]" />
          <div className="absolute left-[14.04px] top-[15.06px] w-[3.9px] h-[3.9px] bg-[#94D1E0]" />
          <div className="absolute left-[23.06px] top-[7.5px] w-[2.43px] h-[2.43px] bg-[#F44336]" />
          <div className="absolute left-[6.67px] top-[23.91px] w-[2.43px] h-[2.43px] bg-[#B2947C]" />
          <div className="absolute left-[3.66px] top-[16.03px] w-[24.85px] h-[1.77px] bg-[#E0C3AB]" />
          <div className="absolute left-[6.67px] top-[7.5px] w-[18.82px] h-[18.84px] bg-[#B2947C]" />
          <div className="absolute left-[15.19px] top-[4.49px] w-[1.77px] h-[24.86px] bg-[#E0C3AB]" />
          <div className="absolute left-[3.89px] top-[4.72px] w-[24.38px] h-[24.4px]" style={{ outline: "3px #E2A610 solid", outlineOffset: "-1.5px" }} />
          <div className="absolute left-[2.15px] top-[2.47px] w-[18.7px] h-[14.27px] bg-[#FFF59D]" />
        </div>

        {/* SPYGLASS */}
        <div data-token="spyglass" className="relative w-[33px] h-[33px] overflow-hidden shrink-0">
          <div className="absolute left-[1.35px] top-[1.34px] w-[30.55px] h-[30.43px] bg-[#604C3D]" />
        </div>

        {/* SAND DOLLAR */}
        <div data-token="sand-dollar" className="relative w-[33px] h-[33px] overflow-hidden shrink-0">
          <div className="absolute left-[2.75px] top-[9.74px] w-[23px] h-[20.51px] bg-[#D55B40]" />
          <div className="absolute left-[11px] top-[2.75px] w-[19.25px] h-[20.63px] bg-[#D55B40] opacity-50" />
        </div>

        {/* ARROW */}
        <div data-token="arrow" className="relative w-[33px] h-[33px] overflow-hidden shrink-0">
          <div className="absolute left-[8.31px] top-[1.32px] w-[19px] h-[30.36px] bg-[#5A50CD]" />
        </div>

        {/* PINEAPPLE */}
        <div data-token="pineapple" className="relative w-[33px] h-[33px] overflow-hidden shrink-0">
          <div className="absolute left-[1.27px] top-[-0.08px] w-[15.9px] h-[17.96px] bg-[#2BA52E]" />
          <div className="absolute left-[10.11px] top-[11.78px] w-[20.96px] h-[20.96px] bg-[#FFD469]" />
          <div className="absolute left-[10.13px] top-[11.78px] w-[20.94px] h-[20.95px] bg-[#FFC136]" />
        </div>

        {/* MAP */}
        <div data-token="map" className="relative w-[34px] h-[33px] overflow-hidden shrink-0">
          <div className="absolute left-[2.28px] top-[2.24px] w-[29.44px] h-[28.53px] bg-[#185476]" />
        </div>

        {/* SEASHELL */}
        <div data-token="seashell" className="relative w-[33px] h-[33px] overflow-hidden shrink-0">
          <div className="absolute left-[0.39px] top-[0.7px] w-[32.23px] h-[31.6px] bg-[#ACBBBA]" />
          <div className="absolute left-[4.02px] top-[3.93px] w-[25.58px] h-[25.57px] bg-[#819A97]" />
          <div className="absolute left-[23.76px] top-[14.73px] w-[5.61px] h-[7.88px] bg-[#6F7F7D]" />
        </div>
        
        {/* --- ICON DRAWINGS END --- */}

      </div>
    </div>
  );
}