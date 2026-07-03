import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/services/supabase/types/database";
import { stripe } from "@/src/services/stripe/client";
import { getStripeCustomerIdForAccount } from "@/src/lib/payments/server/getStripeCustomerIdForAccount";
import { findActiveStripeSubscriptionByStudent } from "@/src/lib/payments/server/findActiveStripeSubscriptionByStudent";

type ResumeSubscriptionResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

/**
 * Resumes auto-renewal for a subscription that was scheduled to cancel at
 * period end. It is assumed that `requireRole([1])` + ownership checks have
 * been run.
 *
 * Reverses a pending cancellation: clears `cancel_at_period_end` on the Stripe
 * subscription (the billing source of truth) and nulls out `cancelled_at` on
 * the local `student_subscriptions` row.
 *
 * Stripe is updated first, then the DB.
 *
 * @param supabase - Request-scoped Supabase client
 * @param input.accountId - Owning account of the subscription
 * @param input.studentId - Student whose subscription is resuming
 * @returns `{ ok: true }` on success, or `{ ok: false, status, error }`
 *   when there is no scheduled cancellation, Stripe customer, or Stripe sub.
 */
export async function resumeSubscription(
  supabase: SupabaseClient<Database>,
  input: { accountId: string; studentId: string },
): Promise<ResumeSubscriptionResult> {
  const { accountId, studentId } = input;

  // Find the active-but-cancelling subscription
  const { data: subscription } = await supabase
    .from("student_subscriptions")
    .select("id")
    .eq("student_id", studentId)
    .eq("status", "active")
    .not("cancelled_at", "is", null)
    .order("current_period_end", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!subscription) {
    return {
      ok: false,
      status: 404,
      error: "No cancellation scheduled for this subscription",
    };
  }

  // Resolve the Stripe customer
  const stripeCustomerId = await getStripeCustomerIdForAccount({
    supabase,
    accountId,
  });
  if (!stripeCustomerId) {
    return { ok: false, status: 404, error: "No Stripe customer found" };
  }

  // Find the live Stripe subscription matched by the studentId
  const stripeSubscription = await findActiveStripeSubscriptionByStudent({
    customerId: stripeCustomerId,
    studentId,
  });
  if (!stripeSubscription) {
    return { ok: false, status: 404, error: "No Stripe subscription found" };
  }

  // Clear cancel_at_period_end
  await stripe.subscriptions.update(stripeSubscription.id, {
    cancel_at_period_end: false,
  });

  const { error: updateError } = await supabase
    .from("student_subscriptions")
    .update({ cancelled_at: null })
    .eq("id", subscription.id);

  if (updateError) {
    console.error("resume: error updating student_subscriptions:", updateError);
  }

  return { ok: true };
}
