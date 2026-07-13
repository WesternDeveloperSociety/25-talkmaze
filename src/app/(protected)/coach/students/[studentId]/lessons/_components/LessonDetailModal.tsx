"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";
import { Button } from "@/src/components/ui/button";
import { api, apiFetch } from "@/src/lib/api/routes";
import { ExternalLinkIcon } from "@/src/components/ui/icons";
import { LESSON_STATUS_OPTIONS } from "@/src/lib/lessons/lessonStatus";

export interface LessonModalData {
  lessonId: string;
  lessonNumber: number;
  title: string;
  courseName: string;
  description: string | null;
  preUrl: string | null;
  postUrl: string | null;
  slideUrl: string | null;
}

interface Props {
  studentId: string;
  lesson: LessonModalData;
  status: number;
  onClose: () => void;
  /** Lifts the new status up so the card badge stays in sync. */
  onStatusChange: (lessonId: string, status: number) => void;
}

function ResourceLink({ label, href }: { label: string; href: string | null }) {
  if (!href) {
    return (
      <Button variant="outline-light" size="sm" disabled className="text-xs">
        {label}
      </Button>
    );
  }
  return (
    <Button asChild variant="outline-light" size="sm" className="text-xs">
      <a href={href} target="_blank" rel="noopener noreferrer">
        {label}
        <ExternalLinkIcon size={11} />
      </a>
    </Button>
  );
}

export default function LessonDetailModal({
  studentId,
  lesson,
  status,
  onClose,
  onStatusChange,
}: Props) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "error" | "success";
    text: string;
  } | null>(null);

  const handleStatusChange = async (next: number) => {
    if (next === status) return;
    const prev = status;
    setSaving(true);
    setMessage(null);
    onStatusChange(lesson.lessonId, next); // optimistic
    try {
      const res = await apiFetch(api.lessonProgress.root(), {
        method: "PATCH",
        json: {
          student_id: studentId,
          lesson_id: lesson.lessonId,
          status: next,
        },
      });
      if (!res.ok) throw new Error("Failed to update status");
      setMessage({ type: "success", text: "Progress updated." });
    } catch {
      onStatusChange(lesson.lessonId, prev); // revert on failure
      setMessage({
        type: "error",
        text: "Could not update progress. Please try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent
        variant="light"
        size="lg"
        className="flex max-h-[85vh] flex-col"
      >
        <DialogHeader>
          <DialogTitle>{lesson.title}</DialogTitle>
          <DialogDescription>
            Lesson {lesson.lessonNumber}
            {lesson.courseName ? ` · ${lesson.courseName}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="-mx-6 flex flex-1 flex-col gap-5 overflow-y-auto px-6">
          {/* Description */}
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#2B4257]/50">
              Description
            </p>
            <p className="text-sm text-[#2B4257]/80">
              {lesson.description || (
                <span className="italic text-gray-400">No description.</span>
              )}
            </p>
          </div>

          {/* Resources */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#2B4257]/50">
              Resources
            </p>
            <div className="flex flex-wrap gap-2">
              <ResourceLink label="Pre-lesson" href={lesson.preUrl} />
              <ResourceLink label="Post-lesson" href={lesson.postUrl} />
              <ResourceLink label="Slides" href={lesson.slideUrl} />
            </div>
          </div>

          {/* Progress */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#2B4257]/50">
              Progress
            </p>
            <div className="flex items-center gap-2">
              <Select
                value={String(status)}
                onValueChange={(v) => handleStatusChange(Number(v))}
                disabled={saving}
              >
                <SelectTrigger
                  variant="light"
                  size="sm"
                  aria-label="Lesson status"
                  className="w-44 min-h-11 md:min-h-9"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent variant="light">
                  {LESSON_STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={String(o.value)}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {saving && (
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#2B4257] border-t-transparent" />
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="sm:items-center sm:justify-between">
          <span className="min-h-4 text-xs">
            {message && (
              <span
                className={
                  message.type === "error" ? "text-red-600" : "text-emerald-700"
                }
              >
                {message.text}
              </span>
            )}
          </span>
          <Button asChild variant="dark" size="md">
            <Link
              href={`/coach/students/${studentId}/lessons/${lesson.lessonId}`}
            >
              Edit Lesson &amp; Tasks
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
