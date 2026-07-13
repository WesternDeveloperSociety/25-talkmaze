import "server-only";

import { getCurrentUser } from "@/src/lib/auth/server/getCurrentUser";
import { createClient } from "@/src/services/supabase/server";

/**
 * Number of pending reschedule requests addressed to the current coach.
 *
 * Resolves the coach from the authenticated user, then counts `sessions` rows
 * for that coach whose `reschedule_status` is "pending". Returns 0 when there
 * is no user, no coach record, or on error — so callers can seed a badge
 * without extra guards.
 *
 * Seeds the coach sidebar "Requests" badge (server-rendered, no flash); the
 * badge is later refetched client-side via GET /api/reschedule-requests
 * (its `requests.length` is this same count).
 */
export async function getPendingRescheduleCount(): Promise<number> {
  const user = await getCurrentUser();
  if (!user) return 0;

  const supabase = await createClient();

  const { data: coach } = await supabase
    .from("coaches")
    .select("id")
    .eq("account_id", user.id)
    .maybeSingle();
  if (!coach) return 0;

  const { count, error } = await supabase
    .from("sessions")
    .select("id", { count: "exact", head: true })
    .eq("coach_id", coach.id)
    .eq("reschedule_status", "pending");

  if (error) {
    console.error("Error fetching pending reschedule count:", error);
    return 0;
  }

  return count ?? 0;
}
