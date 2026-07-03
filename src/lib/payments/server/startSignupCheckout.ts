import "server-only";

import { stripe } from "@/src/services/stripe/client";
import { buildSubscriptionResponse } from "@/src/lib/payments/server/buildSubscriptionResponse";

type StartSignupCheckoutResult = Awaited<
  ReturnType<typeof buildSubscriptionResponse>
>;

/**
 * Public signup checkout (studentId === "new"), taken by anonymous callers. No
 * auth gate and no DB writes here: it creates a fresh Stripe customer and
 * delegates to `buildSubscriptionResponse`. 
 * 
 * The account/student rows are created later by the Stripe webhook once payment 
 * succeeds, keyed off the "new" sentinels carried in the subscription metadata
 * 
 * This separate checkout function for signup needs to exist because at that 
 * stage the user has no account, student row, or Stripe customer yet, so the 
 * authed flow's customer-reuse and duplicate-subscription guard have nothing to
 * act on.
 *
 * @param input.email - Email for the new Stripe customer; null is tolerated.
 * @param input.priceId - Stripe price the subscription is created against.
 * @returns The shared `buildSubscriptionResponse` result: `{ ok: true }` with
 *   the client secret, subscription id, and prefill, or
 *   `{ ok: false, status, error }`.
 */
export async function startSignupCheckout(input: {
  email: string | null;
  priceId: string;
}): Promise<StartSignupCheckoutResult> {
  const { email, priceId } = input;

  const customer = await stripe.customers.create({
    email: email ?? undefined,
  });

  return buildSubscriptionResponse({
    customerId: customer.id,
    accountId: "new",
    studentId: "new",
    priceId,
  });
}
