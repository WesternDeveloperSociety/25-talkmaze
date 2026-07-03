import "server-only";

import type Stripe from "stripe";
import { stripe } from "@/src/services/stripe/client";

type BuildSubscriptionResponseResult =
  | {
      ok: true;
      clientSecret: string;
      subscriptionId: string;
      prefill: { name: string; email: string; phone: string };
    }
  | { ok: false; status: number; error: string };

/**
 * Creates the pending Stripe subscription and returns everything the frontend
 * PaymentElement needs to collect payment. This is the shared final step of
 * both checkout flows - `startSignupCheckout` and `startAuthedCheckout` each do
 * their own auth/customer setup, then delegate here so the two paths can't
 * drift in how the subscription is created.
 *
 * Assumes the Stripe customer already exists; the caller creates or resolves it
 *
 * @param input.customerId - Existing Stripe customer to bill and prefill from.
 * @param input.accountId - Account id, written to subscription metadata for the
 *   Stripe webhook to key off. "new" during signup, before the account exists
 * @param input.studentId - Student id, written to subscription metadata for the
 *   Stripe webhook to key off. `"new"` during signup, before the student exists
 * @param input.priceId - Stripe price the subscription is created against
 * @returns On success, `{ ok: true }` with the PaymentElement `clientSecret`,
 *   the `subscriptionId`, and customer `prefill`. When no client secret can be
 *   resolved, `{ ok: false, status, error }`
 */
export async function buildSubscriptionResponse(input: {
  customerId: string;
  accountId: string;
  studentId: string;
  priceId: string;
}): Promise<BuildSubscriptionResponseResult> {
  const { customerId, accountId, studentId, priceId } = input;

  // Pull up-to-date customer to prefill checkout form
  const customer = (await stripe.customers.retrieve(
    customerId,
  )) as Stripe.Customer;
  const prefill = {
    name: customer.name ?? "",
    email: customer.email ?? "",
    phone: customer.phone ?? "",
  };

  // Drain any pre-existing "incomplete" subscriptions for this customer.
  // Next.js Router Cache can replay the checkout page mount on browser-back,
  // creating orphaned incomplete subs. Clean them before creating a new one.
  const existingIncomplete = await stripe.subscriptions.list({
    customer: customerId,
    status: "incomplete",
  });
  await Promise.all(
    existingIncomplete.data.map((sub) => stripe.subscriptions.cancel(sub.id)),
  );

  // Construct the new subscription
  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    payment_behavior: "default_incomplete",
    payment_settings: { save_default_payment_method: "on_subscription" },
    metadata: {
      account_id: accountId,
      student_id: studentId,
      price_id: priceId,
    },
    expand: [
      "latest_invoice.payment_intent",
      "latest_invoice.confirmation_secret",
    ],
  });

  type ExpandedInvoice = Stripe.Invoice & {
    payment_intent: Stripe.PaymentIntent | null;
    confirmation_secret: { client_secret: string | null } | null;
  };

  const invoice = subscription.latest_invoice as ExpandedInvoice | null;

  // Extract the client secret
  const clientSecret =
    invoice?.payment_intent?.client_secret ??
    invoice?.confirmation_secret?.client_secret ??
    null;

  if (!clientSecret) {
    return {
      ok: false,
      status: 500,
      error: "Unable to initialize subscription payment",
    };
  }

  return {
    ok: true,
    clientSecret,
    subscriptionId: subscription.id,
    prefill,
  };
}
