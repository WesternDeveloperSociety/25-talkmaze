import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/services/supabase/types/database";
import { stripe } from "@/src/services/stripe/client";
import { buildSubscriptionResponse } from "@/src/lib/payments/server/buildSubscriptionResponse";

type StartAuthedCheckoutResult = Awaited<
  ReturnType<typeof buildSubscriptionResponse>
>;

/**
 * Authed checkout for an existing family (studentId is a real UUID). The caller
 * has already enforced `requireRole([1])` + `assertOwnsStudent`, so this
 * assumes the account owns the student and focuses on the payments work
 *
 * @param supabase - Request-scoped Supabase client
 * @param input.accountId - Owning account of the student
 * @param input.userEmail - Email for a newly-created Stripe customer
 * @param input.studentId - Student being subscribed
 * @param input.priceId - Stripe price the subscription is created against.
 * @returns The shared `buildSubscriptionResponse` result: `{ ok: true }` with
 *   the client secret, subscription id, and prefill,
 *   or `{ ok: false, status, error }`
 */
export async function startAuthedCheckout(
  supabase: SupabaseClient<Database>,
  input: {
    accountId: string;
    userEmail: string | null;
    studentId: string;
    priceId: string;
  },
): Promise<StartAuthedCheckoutResult> {
  const { accountId, userEmail, studentId, priceId } = input;

  // Block duplicate active subscriptions for this student.
  const { data: existingSub } = await supabase
    .from("student_subscriptions")
    .select("id")
    .eq("student_id", studentId)
    .eq("status", "active")
    .maybeSingle();

  if (existingSub) {
    return {
      ok: false,
      status: 409,
      error: "Student already has an active subscription",
    };
  }

  // Reuse or create the Stripe customer.
  const { data: account } = await supabase
    .from("account")
    .select("stripe_customer_id")
    .eq("id", accountId)
    .single();

  const customerId =
    account?.stripe_customer_id ||
    (await stripe.customers.create({ email: userEmail ?? undefined })).id;

  if (!account?.stripe_customer_id) {
    await supabase
      .from("account")
      .update({ stripe_customer_id: customerId })
      .eq("id", accountId);
  }

  return buildSubscriptionResponse({
    customerId,
    accountId,
    studentId,
    priceId,
  });
}
