import { describe, it, expect } from "vitest";
import { computeAttendanceStreak } from "@/src/utils/attendanceStreak";

describe("computeAttendanceStreak", () => {
  it("returns 0 for no records", () => {
    expect(computeAttendanceStreak([])).toBe(0);
  });

  it("counts a run of attended records", () => {
    expect(
      computeAttendanceStreak([
        { status: "attended" },
        { status: "attended" },
        { status: "attended" },
      ]),
    ).toBe(3);
  });

  it("skips cancelled records without breaking or counting them", () => {
    // newest first: attended, cancelled, attended → streak = 2
    expect(
      computeAttendanceStreak([
        { status: "attended" },
        { status: "cancelled" },
        { status: "attended" },
      ]),
    ).toBe(2);
  });

  it("breaks the streak on a missed record", () => {
    // attended, attended, missed, attended → streak = 2
    expect(
      computeAttendanceStreak([
        { status: "attended" },
        { status: "attended" },
        { status: "missed" },
        { status: "attended" },
      ]),
    ).toBe(2);
  });

  it("returns 0 when the most recent record breaks the streak", () => {
    expect(
      computeAttendanceStreak([
        { status: "missed" },
        { status: "attended" },
      ]),
    ).toBe(0);
  });

  it("is uncapped — counts more than 12 consecutive attended records", () => {
    const records = Array.from({ length: 20 }, () => ({ status: "attended" }));
    expect(computeAttendanceStreak(records)).toBe(20);
  });
});
