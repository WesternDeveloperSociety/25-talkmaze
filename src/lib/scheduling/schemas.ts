import { z } from "zod";
import { isValidTimeZone, normalizeTimeZone } from "./timezones";

/**
 * Body for POST /api/sessions/[id]/reschedule-request. Both fields are
 * ISO 8601 datetime strings; cross-field ordering (end > start) and future-
 * dating are enforced server-side inside createRescheduleRequest so the error
 * messages can include the offending values.
 */
export const createRescheduleRequestBodySchema = z
  .object({
    requested_start_time: z.string().datetime(),
    requested_end_time: z.string().datetime(),
  })
  .strict();

/**
 * One time-range slot, with "HH:mm" strings.
 * The refinement enforces end > start.
 */
export const availabilitySlotSchema = z
  .object({
    start: z.string().min(1, "Start time required"),
    end: z.string().min(1, "End time required"),
  })
  .refine((data) => !data.start || !data.end || data.end > data.start, {
    message: "End time must be after start time",
    path: ["end"],
  });

/**
 * A full weekly availability map (day name -> slots). Considered valid only if
 * at least one day has at least one fully-filled slot, so we never accept an
 * empty schedule.
 */
export const weeklyAvailabilitySchema = z
  .record(z.string(), z.array(availabilitySlotSchema))
  .refine(
    (val) => {
      const entries = Object.entries(val);
      if (entries.length === 0) return false;
      return entries.every(([, slots]) => slots.some((s) => s.start && s.end));
    },
    { message: "Please ensure all selected days have valid time slots" },
  );

export const timeZoneSchema = z
  .string()
  .trim()
  .min(1, "Time zone is required")
  .refine((value) => isValidTimeZone(value), {
    message: "Please select a valid time zone",
  })
  .transform((value) => normalizeTimeZone(value) ?? value);

/**
 * Top-level form schema for surfaces that submit availability together with the
 * student's timezone.
 */
export const availabilityFormSchema = z.object({
  availability: weeklyAvailabilitySchema,
  timeZone: timeZoneSchema,
});
