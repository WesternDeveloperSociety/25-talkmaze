import Link from "next/link";
import { Award } from "lucide-react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
import LessonProgressBar from "@/src/app/(protected)/(families)/_components/LessonProgressBar";

interface CourseProgressCardProps {
  /** Optional section heading rendered inside the card (e.g. "Active course"). */
  heading?: string;
  /** Course completion badge image (the reward earned at 100%). */
  badgeUrl: string | null;
  title: string;
  description?: string | null;
  completedLessons: number;
  totalLessons: number;
  /** The lesson the student is currently working on, e.g. "Blends in sentences". */
  currentLessonTitle?: string | null;
  /** 1-based position of the current lesson, for the "Lesson N of M" caption. */
  currentLessonNumber?: number;
  /** When set, renders a "Manage courses" action linking here. */
  manageHref?: string;
}

/**
 * A course presented in the reward-card style: the completion badge stands in
 * for the avatar, the course title/description for the name/subtitle, and a
 * `LessonProgressBar` for progress. No token row. Shared so other surfaces can
 * adopt the same treatment.
 */
export default function CourseProgressCard({
  heading,
  badgeUrl,
  title,
  description,
  completedLessons,
  totalLessons,
  currentLessonTitle,
  currentLessonNumber,
  manageHref,
}: CourseProgressCardProps) {
  const lessonCaption =
    totalLessons > 0
      ? `Lesson ${currentLessonNumber ?? Math.min(completedLessons + 1, totalLessons)} of ${totalLessons}${
          currentLessonTitle ? ` · ${currentLessonTitle}` : ""
        }`
      : currentLessonTitle ?? null;

  return (
    <Card variant="light" padding="md" shadow="md" className="gap-4">
      {heading && (
        <CardHeader>
          <CardTitle className="font-semibold text-[#2B4257]">
            {heading}
          </CardTitle>
        </CardHeader>
      )}
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <span className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#2B4257]/5">
            {badgeUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- badge host not in next/image allowlist (matches ClaimedBadge)
              <img
                src={badgeUrl}
                alt={`${title} completion badge`}
                className="size-full object-contain"
              />
            ) : (
              <Award className="size-7 text-[#2B4257]/40" aria-hidden />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <h4 className="truncate font-bold text-[#1F2E3B]">{title}</h4>
            {(description || lessonCaption) && (
              <p className="truncate text-sm text-[#2B4257]/60">
                {lessonCaption ?? description}
              </p>
            )}
          </div>
        </div>

        <LessonProgressBar current={completedLessons} total={totalLessons} />
      </CardContent>

      {manageHref && (
        <CardFooter>
          <Button asChild variant="secondary" size="md">
            <Link href={manageHref}>Manage courses</Link>
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
