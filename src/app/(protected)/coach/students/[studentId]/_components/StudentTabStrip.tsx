"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/src/components/ui/tabs";

interface StudentTabStripProps {
  studentId: string;
}

// Dark-container overrides: visible inactive text + a white active pill (the
// default shadcn tokens read as dark-on-dark here).
const triggerClassName =
  "text-white/70 hover:text-white data-[state=active]:bg-white data-[state=active]:text-[#1F2E3B]";

/**
 * URL-driven tab strip for a student, built on the shadcn Tabs. Each tab is its
 * own route under /coach/students/[studentId], so the triggers are Links and the
 * active `value` is derived from the pathname (the tab content is the route
 * children, not a TabsContent).
 */
export default function StudentTabStrip({ studentId }: StudentTabStripProps) {
  const pathname = usePathname();
  const base = `/coach/students/${studentId}`;

  const value = pathname.startsWith(`${base}/lessons`)
    ? "lessons"
    : pathname.startsWith(`${base}/courses`)
      ? "courses"
      : pathname.startsWith(`${base}/attendance`)
        ? "attendance"
        : "overview";

  const tabs = [
    { value: "overview", label: "Overview", href: base },
    { value: "lessons", label: "Lessons", href: `${base}/lessons` },
    { value: "courses", label: "Courses", href: `${base}/courses` },
    { value: "attendance", label: "Scheduling & Attendance", href: `${base}/attendance` },
  ];

  return (
    <Tabs value={value} activationMode="manual">
      <TabsList className="bg-white/5">
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
            asChild
            className={triggerClassName}
          >
            <Link href={tab.href}>{tab.label}</Link>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
