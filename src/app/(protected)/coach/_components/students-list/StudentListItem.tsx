import Link from "next/link";
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
} from "@/src/components/ui/avatar";
import type { CoachStudent } from "../../_lib/getCoachDashboardContext";
import { cn } from "@/src/utils/cn";
import { fullName, initials } from "@/src/utils/formatName";

interface StudentListItemProps {
  student: CoachStudent;
  isActive: boolean;
}

/**
 * A single "My Students" row, styled as a compact profile card (avatar + name +
 * active-course subtitle + status dot). The whole card links to the student's
 * Overview; per-student quick actions now live in the header banner (Message /
 * Start lesson) and the Courses tab (assign), to match the redesign.
 */
export default function StudentListItem({
  student,
  isActive,
}: StudentListItemProps) {
  const studentFullName = fullName(
    student.first_name,
    student.last_name,
    "Unnamed Student",
  );

  // Status dot reflects subscription health.
  // Green = active subscription, amber = no active subscription.
  const isActiveStatus = student.hasActiveSubscription;

  return (
    <li>
      <Link
        href={`/coach/students/${student.id}`}
        aria-current={isActive ? "page" : undefined}
        aria-label={`Open details for ${studentFullName}`}
        className={cn(
          "flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30",
          isActive
            ? "border-white/10 bg-white/10"
            : "border-transparent hover:bg-white/5",
        )}
      >
        <Avatar size="md" variant="teal" shape="circle">
          <AvatarImage
            src={student.avatar_url}
            alt={studentFullName}
            sizes="44px"
          />
          <AvatarFallback>{initials(studentFullName, 1)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">
            {studentFullName}
          </p>
          <p className="truncate text-xs text-white/60">
            {student.activeCourseTitle ?? "No active course"}
          </p>
        </div>
        <span
          className={cn(
            "h-2.5 w-2.5 shrink-0 rounded-full",
            isActiveStatus ? "bg-[#65CFAD]" : "bg-[#bbbbbb]",
          )}
          title={
            isActiveStatus ? "Active subscription" : "No active subscription"
          }
          aria-hidden
        />
      </Link>
    </li>
  );
}
