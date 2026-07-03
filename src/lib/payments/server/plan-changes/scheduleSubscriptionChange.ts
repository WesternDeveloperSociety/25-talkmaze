import "server-only";

import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/services/supabase/types/database";
import { stripe } from "@/src/services/stripe/client";
import { getStripeCustomerIdForAccount } from "@/src/lib/payments/server/getStripeCustomerIdForAccount";
import { findActiveStripeSubscriptionByStudent } from "@/src/lib/payments/server/findActiveStripeSubscriptionByStudent";

type ScheduleSubscriptionChangeResult =
  | {
      ok: true;
      clientSecret: string;
      prefill: { name: string; email: string; phone: string };
      effectiveDate: string;
    }
  | { ok: false; status: number; error: string };

/**
 * Begins a plan upgrade/downgrade for a student's active subscription. It is
 * assumed that `requireRole([1])` + ownership checks have been run, so this
 * validates the target plan against the current one, then creates an
 * off-session Stripe SetupIntent whose metadata the `setup_intent.succeeded`
 * webhook uses to build the two-phase SubscriptionSchedule.
 *
 * Charges nothing now and writes nothing to the DB: the change takes effect at
 * the current period end (returned as `effectiveDate`), and the webhook records
 * `pending_plan_id` / `pending_stripe_schedule_id` once the SetupIntent
 * confirms.
 *
 * @param supabase - Request-scoped Supabase client
 * @param input.accountId - Owning account of the subscription
 * @param input.studentId - Student whose subscription is changing
 * @param input.priceId - Stripe price of the target plan
 * @returns `{ ok: true }` with the SetupIntent. Otherwise `{ ok: false, status,
 *   error }`
 */
export async function scheduleSubscriptionChange(
  supabase: SupabaseClient<Database>,
  input: { accountId: string; studentId: string; priceId: string },
): Promise<ScheduleSubscriptionChangeResult> {
  const { accountId, studentId, priceId } = input;

  // Load the current active subscription and plan
  const { data: currentSubscription } = await supabase
    .from("student_subscriptions")
    .select(
      `
        id,
        pending_plan_id,
        pending_stripe_schedule_id,
        plans!student_plans_plan_id_fkey (
          id,
          name,
          cents,
          stripe_price_id
        )
      `,
    )
    .eq("student_id", studentId)
    .eq("status", "active")
    .order("current_period_end", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!currentSubscription) {
    return { ok: false, status: 404, error: "No active subscription found" };
  }

  const currentPlan = Array.isArray(currentSubscription.plans)
    ? currentSubscription.plans[0]
    : currentSubscription.plans;

  if (!currentPlan) {
    return { ok: false, status: 500, error: "Current plan not found" };
  }

  // Look up the plans targetted by the stripe priceId
  const { data: targetPlan, error: targetPlanError } = await supabase
    .from("plans")
    .select("id, name, cents, stripe_price_id")
    .eq("stripe_price_id", priceId)
    .single();

  if (targetPlanError || !targetPlan) {
    return { ok: false, status: 404, error: "Target plan not found" };
  }

  // Guard: If student is subbed to the target plan
  if (targetPlan.stripe_price_id === currentPlan.stripe_price_id) {
    return {
      ok: false,
      status: 409,
      error: "You are already on this plan. It will auto-renew.",
    };
  }

  // Guard: Student is already scheduled to change to the target plan
  if (currentSubscription.pending_plan_id === targetPlan.id) {
    return {
      ok: false,
      status: 409,
      error: "This plan change is already scheduled",
    };
  }

  // Resolve the Stripe customer
  const customerId = await getStripeCustomerIdForAccount({
    supabase,
    accountId,
  });

  if (!customerId) {
    return { ok: false, status: 404, error: "No Stripe customer found" };
  }

  const customer = (await stripe.customers.retrieve(
    customerId,
  )) as Stripe.Customer;
  const prefill = {
    name: customer.name ?? "",
    email: customer.email ?? "",
    phone: customer.phone ?? "",
  };

  // Find the live Stripe subscription for the customer's student
  const stripeSubscription = await findActiveStripeSubscriptionByStudent({
    customerId,
    studentId,
  });

  if (!stripeSubscription) {
    return { ok: false, status: 404, error: "No Stripe subscription found" };
  }

  // Create the SetupIntent with the metadata
  const setupIntent = await stripe.setupIntents.create({
    customer: customerId,
    usage: "off_session",
    metadata: {
      account_id: accountId,
      student_id: studentId,
      target_price_id: priceId,
      stripe_subscription_id: stripeSubscription.id,
      // `replace_schedule_id` in the metadata lets the webhook supersede
      // an already-pending change instead of stacking a second schedule.
      replace_schedule_id: currentSubscription.pending_stripe_schedule_id ?? "",
    },
  });

  if (!setupIntent.client_secret) {
    return {
      ok: false,
      status: 500,
      error: "Unable to initialize plan change confirmation",
    };
  }

  // compute effectiveDate - the current period end
  type SubscriptionItemWithPeriod = Stripe.SubscriptionItem & {
    current_period_end: number;
  };

  const subscriptionItem = stripeSubscription.items
    .data[0] as SubscriptionItemWithPeriod;
  const effectiveDate = new Date(
    subscriptionItem.current_period_end * 1000,
  ).toISOString();

  return {
    ok: true,
    clientSecret: setupIntent.client_secret,
    prefill,
    effectiveDate,
  };
}
