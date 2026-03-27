"use client";
import Link from "next/link";
import { ReactNode } from "react";

type Props = {
  id: number;
  name: string;
  state: boolean;
  link: string;
  onSelect?: () => void;
  icon?: ReactNode;
};

export default function SideBarBox({
  id,
  name,
  state,
  link,
  onSelect,
  icon,
}: Props) {
  const backgroundColor = state ? "bg-[#B1E7D6]" : "bg-[#1F2E3B]";
  const textColor = state ? "text-[#1F2E3B]" : "text-[#B1E7D6]";

  return (
    <Link href={link}>
      <div
        className={`text-sm md:text-[1rem] flex flex-row lg:flex-row-reverse 
          justify-between lg:justify-end items-center 
          w-auto lg:max-w-[204px] lg:h-[78px] px-1 lg:px-10
          lg:shadow-[0_4px_4px_rgba(0,0,0,0.25)] ${backgroundColor} 
          rounded-lg lg:rounded-2xl font-semibold`}
        onClick={onSelect}
      >
        <p className={`${textColor} text-center lg:ml-6`}>{name}</p>
        {icon}
      </div>
    </Link>
  );
}
