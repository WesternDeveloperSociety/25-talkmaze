export type AttendanceStatus = "attended" | "missed" | "cancelled";

export interface CoachSession {
  id: number;
  weekday: number;
  start_time: string;
  end_time: string;
  requested_start_time: string | null;
  requested_end_time: string | null;
  reschedule_status: "pending" | null;
}
