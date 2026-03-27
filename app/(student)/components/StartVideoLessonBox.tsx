//start video lesson box component
"use client"
import { useEffect, useState } from "react";
import Link from 'next/link';
import { getLessonSpace } from "./startVideoLessonBoxActions";
import { NextResponse } from "next/server";
export default function StartVideoLessonBox() {
  const[link,setLink] = useState<string>("");
  useEffect(() => {
    async function getLink(){
      const link_res = await getLessonSpace();
      if(!link_res){
        return new Error("Can get lesson link")
      }
      console.log("Setting link: " + link_res);
      setLink(link_res)
    }

    getLink();
  },[])
  
  return (
    <div className="text-[12px] md:text-[16px] md:font-semibold h-[30px] w-[172px] md:w-[272.29px] md:h-[51px] border-[0.5px]  rounded-[15px] bg-[#1F2E3B] border-[#1F2E3B] shadow-[0_4px_4px_rgba(0,0,0,0.25)] text-white flex justify-center items-center gap-2.5">
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        className="md:w-6 md:h-6"
      >
        <path
          d="M13.3333 2.6665C13.687 2.6665 14.0261 2.80698 14.2761 3.05703C14.5262 3.30708 14.6667 3.64622 14.6667 3.99984V10.6665C14.6667 11.4065 14.0733 11.9998 13.3333 11.9998H16V13.3332H0V11.9998H2.66667C2.31304 11.9998 1.97391 11.8594 1.72386 11.6093C1.47381 11.3593 1.33333 11.0201 1.33333 10.6665V3.99984C1.33333 3.25984 1.92667 2.6665 2.66667 2.6665H13.3333ZM13.3333 3.99984H2.66667V10.6665H13.3333V3.99984ZM8 7.99984C9.47333 7.99984 10.6667 8.59984 10.6667 9.33317V9.99984H5.33333V9.33317C5.33333 8.59984 6.52667 7.99984 8 7.99984ZM8 4.6665C8.35362 4.6665 8.69276 4.80698 8.94281 5.05703C9.19286 5.30708 9.33333 5.64622 9.33333 5.99984C9.33333 6.35346 9.19286 6.6926 8.94281 6.94265C8.69276 7.19269 8.35362 7.33317 8 7.33317C7.26 7.33317 6.66667 6.73984 6.66667 5.99984C6.66667 5.25984 7.26667 4.6665 8 4.6665Z"
          fill="white"
        />
      </svg>
      <a
        className="text-center"
        href={link}
        target="_blank"
        rel="noopener noreferrer"
      >
        Start Video Lesson
      </a>
    </div>
  );
}
