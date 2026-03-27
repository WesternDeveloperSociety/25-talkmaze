"use client";

import NavigationBar from "./components/NavigationBar";
import { ReactNode } from "react";
import SideBar from "./components/Sidebar";

export default function StudentLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-row w-screen h-screen overflow-hidden">
      <SideBar />
      <div className="flex flex-1 flex-col overflow-y-auto pl-6 pr-6">
        <NavigationBar />
        <div className="bg-[#1f2e3b] w-full flex-1 min-w-[300px] rounded-2xl shadow-[inset_0_4px_12px_rgba(0,0,0,0.6)] mb-6">
          {children}
        </div>
      </div>
    </div>
  );
}
