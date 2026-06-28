"use client";

import { useState } from "react";
import Link from "next/link";
import { Video } from "lucide-react";
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
} from "@/src/components/ui/avatar";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import {
  MessageCircleIcon,
  LocationPinFilledIcon,
} from "@/src/components/ui/icons";
import { fullName, initials } from "@/src/utils/formatName";

interface StudentHeaderBannerProps {
  coachId: string;
  student: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
    grade: string | null;
    location: string | null;
    date_of_birth: string | null;
    is_setup_complete: boolean | null;
  };
}

function formatDob(dob: string | null): string | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Persistent student header above the tab strip: a mint gradient cover + white
 * body card (avatar straddling the two), the student's identity, and the two
 * primary actions (Message the student, launch a video lesson).
 */
export default function StudentHeaderBanner({
  coachId,
  student,
}: StudentHeaderBannerProps) {
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const name = fullName(
    student.first_name,
    student.last_name,
    "Unnamed Student",
  );
  const dob = formatDob(student.date_of_birth);
  const isActive = student.is_setup_complete !== false;

  async function handleStartLesson() {
    setError(null);
    setLaunching(true);
    try {
      const res = await fetch(
        `/api/coach/lessonspace/${coachId}/${student.id}`,
      );
      if (!res.ok) {
        setError("Could not open Lesson Space. Please try again.");
        return;
      }
      const { client_url } = await res.json();
      window.open(client_url, "_blank", "noopener,noreferrer");
    } catch {
      setError("Could not open Lesson Space. Please try again.");
    } finally {
      setLaunching(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
      {/* Mint gradient cover */}
      <div className="h-20 bg-gradient-to-r from-[#59288b] to-[#7564c0]" />

      {/* White body, avatar straddling the cover */}
      <div className="flex flex-col gap-3 px-5 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-end gap-4">
          <Avatar
            size="lg"
            variant="navy"
            className="-mt-10 size-20 shrink-0 ring-4 ring-white"
          >
            <AvatarImage src={student.avatar_url} alt={name} sizes="80px" />
            <AvatarFallback>{initials(name, 2)}</AvatarFallback>
          </Avatar>

          <div className="min-w-0 pb-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold text-[#1F2E3B]">{name}</h2>
              <Badge variant={isActive ? "primary" : "warning"}>
                {isActive ? "Active" : "Setup pending"}
              </Badge>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[#2B4257]/70">
              {student.location && (
                <span className="inline-flex items-center gap-1">
                  <LocationPinFilledIcon size={14} />
                  {student.location}
                </span>
              )}
              {student.grade && <span>Grade {student.grade}</span>}
              {dob && <span>DOB {dob}</span>}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pb-1">
          <Button asChild variant="outline-light" size="md">
            <Link href={`/coach/message/${student.id}`}>
              <MessageCircleIcon size={16} />
              Message
            </Link>
          </Button>
          <Button
            variant="dark"
            size="md"
            onClick={handleStartLesson}
            disabled={launching}
          >
            <Video size={16} />
            {launching ? "Opening..." : "Start lesson"}
          </Button>
        </div>
      </div>
      {error && <p className="px-5 pb-3 text-xs text-red-700">{error}</p>}
    </div>
  );
}
