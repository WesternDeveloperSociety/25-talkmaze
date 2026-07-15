"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import Image from "next/image";
import { completeStudentSetup } from "../actions";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { Textarea } from "@/src/components/ui/textarea";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/src/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";
import {
  timeZoneSchema,
  weeklyAvailabilitySchema,
} from "@/src/lib/scheduling/schemas";
import {
  DEFAULT_TIME_ZONE,
  detectBrowserTimeZone,
} from "@/src/lib/scheduling/timezones";
import { createClient } from "@/src/services/supabase/client";
import TimeZoneSelect from "../../_components/TimeZoneSelect";
import WeeklyAvailabilityEditor, {
  WeeklyAvailabilityValue,
} from "../../_components/WeeklyAvailabilityEditor";

interface Props {
  studentId: string;
  firstName: string;
  lastName: string;
  redirectAfterSetup?: "parent" | "student";
}

/**
 * Composed schema for the full wizard. `availability` uses the shared schema so
 * the rules (end > start, at least one filled slot) stay aligned with the modal
 * Each page validates its own slice via `.pick(...)` before advancing.
 */
const setupSchema = z.object({
  grade: z.number().min(1, "Please select a grade"),
  timeZone: timeZoneSchema,
  availability: weeklyAvailabilitySchema,
});

/**
 * Three-page onboarding wizard for completing a student's profile:
 */
export default function StudentSetupForm({
  studentId,
  firstName,
  lastName,
  redirectAfterSetup = "parent",
}: Props) {
  const router = useRouter();
  const backHref = redirectAfterSetup === "student" ? "/profiles" : "/parent";
  const [page, setPage] = useState(1);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [grade, setGrade] = useState<number>(1);
  const [timeZone, setTimeZone] = useState(DEFAULT_TIME_ZONE);
  const [notes, setNotes] = useState("");
  const [weeklyAvailability, setWeeklyAvailability] =
    useState<WeeklyAvailabilityValue>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setTimeZone(detectBrowserTimeZone());
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  const validatePage1 = () => {
    const result = setupSchema
      .pick({ grade: true, timeZone: true })
      .safeParse({ grade, timeZone });
    if (!result.success) {
      const errs: Record<string, string> = {};
      result.error.issues.forEach((i) => {
        errs[i.path.join(".")] = i.message;
      });
      setErrors(errs);
      return false;
    }
    setErrors({});
    return true;
  };

  const validatePage2 = () => {
    const result = setupSchema
      .pick({ availability: true })
      .safeParse({ availability: weeklyAvailability });
    if (!result.success) {
      const errs: Record<string, string> = {};
      result.error.issues.forEach((i) => {
        errs[i.path.join(".")] = i.message;
      });
      setErrors(errs);
      return false;
    }
    setErrors({});
    return true;
  };

  /**
   * Vets the picked avatar before staging it for upload
   */
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarError(null);
    if (file.size > 2 * 1024 * 1024) {
      setAvatarError("Image must be under 2MB.");
      return;
    }
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!["png", "jpg", "jpeg", "webp", "gif"].includes(ext)) {
      setAvatarError("Allowed formats: PNG, JPG, JPEG, WEBP, GIF.");
      return;
    }
    setPendingFile(file);
    setPendingPreview(URL.createObjectURL(file));
  }

  /**
   * Uploads the staged avatar (if any) to Supabase storage, then calls the
   * server action to persist all collected fields. The action handles the
   * post-setup redirect, so we only reset `isSubmitting` on failure.
   */
  const handleSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      let avatarUrl: string | undefined;
      if (pendingFile) {
        const supabase = createClient();
        const ext = pendingFile.name.split(".").pop();
        const path = `${studentId}/avatar-${Date.now()}.${ext}`;
        await supabase.storage
          .from("avatars")
          .upload(path, pendingFile, { upsert: true });
        const { data } = supabase.storage.from("avatars").getPublicUrl(path);
        avatarUrl = data.publicUrl;
      }
      await completeStudentSetup(
        studentId,
        grade,
        notes,
        timeZone,
        weeklyAvailability,
        redirectAfterSetup,
        avatarUrl,
      );
    } catch {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-[520px] mx-auto p-8">
      <Card variant="light" shadow="md" padding="lg" className="rounded-2xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#2B4257]">
            Complete {firstName} {lastName}&apos;s Profile
          </h1>
          <p className="text-sm text-[#2B4257]/60 mt-1">
            Set up their details and availability so we can match them with a
            coach.
          </p>
          <div className="mt-3 w-16 h-1 bg-[#65CFAD] rounded-full" />
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-6">
          <div
            className={`h-2 flex-1 rounded-full transition-colors ${page >= 1 ? "bg-[#B1E7D6]" : "bg-gray-200"}`}
          />
          <div
            className={`h-2 flex-1 rounded-full transition-colors ${page >= 2 ? "bg-[#B1E7D6]" : "bg-gray-200"}`}
          />
          <div
            className={`h-2 flex-1 rounded-full transition-colors ${page >= 3 ? "bg-[#B1E7D6]" : "bg-gray-200"}`}
          />
        </div>

        {page === 1 && (
          <form
            className="flex flex-col gap-5"
            onSubmit={(e) => {
              e.preventDefault();
              if (validatePage1()) setPage(2);
            }}
          >
            <FieldGroup>
              <Field data-invalid={errors.grade ? true : undefined}>
                <FieldLabel htmlFor="grade-select">Grade</FieldLabel>
                <Select
                  value={String(grade)}
                  onValueChange={(val) => {
                    setGrade(Number(val));
                    if (errors.grade)
                      setErrors((p) => {
                        const n = { ...p };
                        delete n.grade;
                        return n;
                      });
                  }}
                >
                  <SelectTrigger
                    id="grade-select"
                    size="lg"
                    error={!!errors.grade}
                  >
                    <SelectValue placeholder="Select grade" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((g) => (
                      <SelectItem key={g} value={String(g)}>
                        Grade {g}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.grade && <FieldError>{errors.grade}</FieldError>}
              </Field>

              <TimeZoneSelect
                value={timeZone}
                onChange={(next) => {
                  setTimeZone(next);
                  if (errors.timeZone)
                    setErrors((p) => {
                      const n = { ...p };
                      delete n.timeZone;
                      return n;
                    });
                }}
                error={errors.timeZone}
              />

              <Field>
                <FieldLabel htmlFor="notes">
                  Additional notes (optional)
                </FieldLabel>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any context that would help the coach..."
                  className="h-25"
                />
              </Field>
            </FieldGroup>

            <Button
              type="submit"
              variant="accent"
              size="lg"
              className="w-full h-12 mt-2 text-[18px]"
            >
              Next: Set Availability
            </Button>

            <button
              type="button"
              onClick={() => router.push(backHref)}
              className="text-[#1F2E3B]/50 hover:underline text-sm text-center"
            >
              Back to dashboard
            </button>
          </form>
        )}

        {page === 2 && (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (validatePage2()) setPage(3);
            }}
          >
            <p className="text-sm text-[#A8A8A8]">
              Select the days and times {firstName} is available each week.
            </p>

            <WeeklyAvailabilityEditor
              value={weeklyAvailability}
              onChange={setWeeklyAvailability}
              timezone={timeZone}
              errors={errors}
            />

            <Button
              type="submit"
              variant="accent"
              size="lg"
              disabled={isSubmitting}
              className="w-full h-12 mt-2 text-[18px]"
            >
              {isSubmitting ? (
                <>
                  <svg
                    className="animate-spin h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Saving...
                </>
              ) : (
                "Next: Profile Picture"
              )}
            </Button>

            <button
              type="button"
              onClick={() => setPage(1)}
              className="text-[#1F2E3B]/50 hover:underline text-sm text-center"
            >
              Back to student info
            </button>
          </form>
        )}

        {page === 3 && (
          <div className="flex flex-col gap-5">
            <div className="flex flex-col items-center gap-1 mb-2">
              <Image
                src="/images/logos/talkmaze-logo-horizontal-color.svg"
                alt="TalkMaze"
                width={64}
                height={64}
                className="h-16 w-auto object-contain"
              />
            </div>

            <div className="text-center">
              <h2 className="text-lg font-bold text-[#2B4257]">
                Profile Picture
              </h2>
              <p className="text-sm text-[#2B4257]/60 mt-1">
                Upload an image of your child to personalize their profile.
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={handleFileChange}
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mx-auto w-40 h-40 rounded-full border-2 border-dashed border-[#65CFAD] flex flex-col items-center justify-center gap-2 hover:bg-[#65CFAD]/5 transition-colors overflow-hidden"
            >
              {pendingPreview ? (
                <Image
                  src={pendingPreview}
                  alt="Preview"
                  width={160}
                  height={160}
                  className="w-full h-full object-cover rounded-full"
                />
              ) : (
                <>
                  <span className="text-3xl text-[#65CFAD]">+</span>
                  <span className="text-xs text-[#2B4257]/60">
                    Click to upload
                  </span>
                </>
              )}
            </button>

            {avatarError && (
              <p className="text-red-500 text-xs text-center">{avatarError}</p>
            )}

            <p className="text-center text-xs text-[#2B4257]/50 bg-[#F5F5F5] rounded-lg px-4 py-3">
              This step is optional. You can always add a photo later!
            </p>

            <Button
              type="button"
              variant="accent"
              size="lg"
              disabled={isSubmitting}
              onClick={handleSubmit}
              className="w-full h-12 mt-2 text-[18px]"
            >
              {isSubmitting ? (
                <>
                  <svg
                    className="animate-spin h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Saving...
                </>
              ) : (
                "Complete Onboarding"
              )}
            </Button>

            <button
              type="button"
              onClick={() => setPage(2)}
              className="text-[#1F2E3B]/50 hover:underline text-sm text-center"
            >
              Back to availability
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="text-[#1F2E3B]/40 hover:underline text-sm text-center disabled:opacity-50"
            >
              exit
            </button>
          </div>
        )}
      </Card>
    </div>
  );
}
