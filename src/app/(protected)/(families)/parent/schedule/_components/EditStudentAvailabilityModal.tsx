"use client";

import { useEffect, useState } from "react";
import type { StudentProp } from "./ParentScheduleClient";
import { api, apiFetch } from "@/src/lib/api/routes";
import { WEEKDAYS } from "@/src/lib/scheduling/types";
import { availabilityFormSchema } from "@/src/lib/scheduling/schemas";
import {
  DEFAULT_TIME_ZONE,
  detectBrowserTimeZone,
  normalizeTimeZone,
} from "@/src/lib/scheduling/timezones";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";
import { Button } from "@/src/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import WeeklyAvailabilityEditor, {
  WeeklyAvailabilityValue,
} from "../../../_components/WeeklyAvailabilityEditor";

interface Props {
  students: StudentProp[];
  // Pre-select a specific student; null falls back to the first in the list.
  initialStudentId: string | null;
  onClose: () => void;
}

/**
 * Parent-facing modal for editing a student's recurring weekly availability.
 */
export default function EditStudentAvailabilityModal({
  students,
  initialStudentId,
  onClose,
}: Props) {
  const [selectedStudentId, setSelectedStudentId] = useState<string>(
    initialStudentId ?? students[0]?.id ?? "",
  );
  const [availability, setAvailability] = useState<WeeklyAvailabilityValue>({});
  const [timezone, setTimezone] = useState(DEFAULT_TIME_ZONE);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!selectedStudentId) return;

    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      setLoading(true);
      setSaveError(null);
      setSaveSuccess(false);
      setErrors({});

      apiFetch(api.students.availability(selectedStudentId))
        .then((r) => r.json())
        .then(
          (body: {
            availability?: {
              weekday: number;
              start_time: string;
              end_time: string;
              timezone: string;
            }[];
          }) => {
            if (cancelled) return;

            const rows = Array.isArray(body?.availability)
              ? body.availability
              : [];
            const mapped: WeeklyAvailabilityValue = {};
            const savedTimeZone = rows.reduce<string | null>(
              (found, row) => found ?? normalizeTimeZone(row.timezone),
              null,
            );

            setTimezone(savedTimeZone ?? detectBrowserTimeZone());

            rows.forEach(({ weekday, start_time, end_time }) => {
              // DB stores weekday Sunday-first (0..6); WEEKDAYS is Monday-first.
              // Shift by +6 mod 7 to translate: Sun(0)→idx 6, Mon(1)→idx 0, etc.
              const day = WEEKDAYS[(weekday + 6) % 7];
              // start_time/end_time are ISO timestamps like "1970-01-01T14:30:00Z";
              // slice out just the "HH:mm" portion that <input type="time"> expects.
              const start = start_time.slice(11, 16);
              const end = end_time.slice(11, 16);
              if (!mapped[day]) mapped[day] = [];
              mapped[day].push({ start, end });
            });
            setAvailability(mapped);
          },
        )
        .catch(() => {
          // Keep the existing quiet failure behavior; the save path surfaces errors.
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [selectedStudentId]);

  /**
   * Validates locally with Zod before issuing the PUT so users see per-slot errors
   * (e.g. end <= start) without a server round-trip. On success, clears errors,
   * persists, and briefly flashes the success message.
   */
  const handleSave = async () => {
    setSaveError(null);
    setSaveSuccess(false);

    const parsed = availabilityFormSchema.safeParse({
      availability,
      timeZone: timezone,
    });
    if (!parsed.success) {
      // Flatten Zod issues into a path-keyed map the editor knows how to display
      // (see WeeklyAvailabilityEditor's `errors` prop for the recognized keys).
      const next: Record<string, string> = {};
      parsed.error.issues.forEach((i) => {
        next[i.path.join(".")] = i.message;
      });
      setErrors(next);
      return;
    }
    setErrors({});
    const timeZoneToSave = parsed.data.timeZone;
    setTimezone(timeZoneToSave);
    setSaving(true);

    const res = await apiFetch(api.students.availability(selectedStudentId), {
      method: "PUT",
      json: { availability, timezone: timeZoneToSave },
    });

    setSaving(false);

    if (res.ok) {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } else {
      const body = await res.json().catch(() => ({}));
      setSaveError(body.error ?? "Failed to save. Please try again.");
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
        className="flex max-h-[90vh] flex-col"
      >
        <DialogHeader>
          <DialogTitle>Edit Availability</DialogTitle>
          <DialogDescription>
            Edit the available times for this student, so that the coach and
            system can schedule optimal timeslots.
          </DialogDescription>
        </DialogHeader>

        {students.length > 1 && (
          <div className="flex justify-end">
            <Select
              value={selectedStudentId}
              onValueChange={setSelectedStudentId}
            >
              <SelectTrigger size="sm" className="w-auto">
                <SelectValue placeholder="Student" />
              </SelectTrigger>
              <SelectContent>
                {students.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {[s.first_name, s.last_name].filter(Boolean).join(" ") ||
                      "Student"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Body */}
        <div className="-mx-6 flex-1 overflow-y-auto px-6 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <p className="text-[#2B4257]/60 text-sm">Loading…</p>
            </div>
          ) : (
            <WeeklyAvailabilityEditor
              value={availability}
              onChange={setAvailability}
              timezone={timezone}
              onTimezoneChange={setTimezone}
              errors={errors}
            />
          )}
        </div>

        <DialogFooter className="sm:items-center sm:justify-between">
          <div className="text-xs">
            {saveError && <span className="text-red-500">{saveError}</span>}
            {saveSuccess && (
              <span className="text-[#2B4257]">Saved successfully!</span>
            )}
          </div>

          <Button
            variant="default"
            size="md"
            onClick={handleSave}
            disabled={saving || loading}
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
