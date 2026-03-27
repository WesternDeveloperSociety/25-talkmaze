"use client";

import React from "react";
import Link from "next/link";

export default function PaymentStatus({ sessionsLeft = 24, studentId }: { sessionsLeft?: number, studentId?: string }) {
  return (
    <div className="bg-[#B1E7D6] rounded-2xl p-4 shadow-[0_4px_4px_rgba(0,0,0,0.25)] flex items-center gap-6 h-full">
      <div className="relative w-24 h-24 flex-shrink-0 flex items-center justify-center bg-white rounded-full">
         <div className="w-16 h-16 border-[8px] border-[#1F2E3B] rounded-full flex items-center justify-center">
            <div className="w-3 h-3 bg-[#1F2E3B] rounded-full"></div>
         </div>
      </div>

      <div className="flex flex-col items-start gap-3 flex-1">
        <h3 className="text-[#2B4257] font-bold text-base leading-tight">
          {sessionsLeft ?? 0} Sessions Left in Payment Package
        </h3>
        <Link href="/payments">
          <button className="bg-[#1F2E3B] text-white px-6 py-2 rounded-xl text-sm font-bold hover:bg-[#2B4257] transition-colors self-end sm:self-start">
            Renew Now
          </button>
        </Link>
      </div>
    </div>
  );
}
