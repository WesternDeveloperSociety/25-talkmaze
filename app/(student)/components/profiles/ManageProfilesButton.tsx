"use client";

import { useRouter } from "next/navigation";

export default function ManageProfilesButton() {
  const router = useRouter();

  return (
    <button
      onClick={() => router.push("/manageProfile")}
      className="mt-[clamp(16px,1.5vw,24px)] w-[clamp(180px,16vw,240px)] h-[clamp(40px,3.5vw,52px)] bg-[#1f2e3b] border-[0.5px] border-[#4e4c4c] rounded-lg shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] flex items-center justify-center cursor-pointer hover:opacity-90 transition-opacity"
    >
      <span className="text-[clamp(11px,0.9vw,14px)] font-semibold text-white">
        Manage your profiles
      </span>
    </button>
  );
}