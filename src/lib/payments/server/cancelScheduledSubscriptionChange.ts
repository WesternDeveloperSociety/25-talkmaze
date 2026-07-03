import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/services/supabase/types/database";
import { stripe } from "@/src/services/stripe/client";

type CancelScheduledSubscriptionChangeResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

/**
 * Cancels a pending plan change before it takes effect - the inverse of
 * `scheduleSubscriptionChange`.
 *
 * Releases the Stripe SubscriptionSchedule and clears the four `pending_*`
 * columns on the student's active subscription.
 *
 * @param supabase - Request-scoped Supabase client
 * @param input.accountId - Owning account
 * @param input.studentId - Student whose pending plan change is being cancelled
 * @returns `{ ok: true }` on success, or `{ ok: false, status, error }`
 */
export async function cancelScheduledSubscriptionChange(
  supabase: SupabaseClient<Database>,
  input: { accountId: string; studentId: string },
): Promise<CancelScheduledSubscriptionChangeResult> {
  const { studentId } = input;

  // Find the active sub + its pending schedule id
  const { data: subscription } = await supabase
    .from("student_subscriptions")
    .select("id, pending_stripe_schedule_id")
    .eq("student_id", studentId)
    .eq("status", "active")
    .order("current_period_end", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!subscription?.pending_stripe_schedule_id) {
    return { ok: false, status: 404, error: "No pending plan change found" };
  }

  try {
    await stripe.subscriptionSchedules.release(
      subscription.pending_stripe_schedule_id,
    );
  } catch (releaseError) {
    console.error("schedule-cancel: schedule release failed", releaseError);
  }

  // Clear the four pending_* columns from the DB record
  const { error: updateError } = await supabase
    .from("student_subscriptions")
    .update({
      pending_plan_id: null,
      pending_effective_date: null,
      pending_stripe_schedule_id: null,
      pending_created_at: null,
    })
    .eq("id", subscription.id);

  if (updateError) {
    console.error("schedule-cancel: update error", updateError);
  }

  return { ok: true };
}
