import "server-only";

import Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/services/supabase/types/database";
import { stripe } from "@/src/services/stripe/client";
import { isWithinRefundWindow } from "@/src/lib/payments/server/policies";
import { getStripeCustomerIdForAccount } from "@/src/lib/payments/server/getStripeCustomerIdForAccount";
import { findActiveStripeSubscriptionByStudent } from "@/src/lib/payments/server/findActiveStripeSubscriptionByStudent";

type CancelSubscriptionResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

type RefundTarget = {
  paymentIntentId: string | null;
  chargeId: string | null;
};

type LegacyInvoice = Stripe.Invoice & {
  payment_intent?: string | Stripe.PaymentIntent | null;
  charge?: string | Stripe.Charge | null;
};

// Stripe "expandable" fields arrive as either the raw id string or the full
// object (depending on whether the caller expanded them). Normalize both to the
// id string, or null when absent.
function getExpandableId<T extends { id: string }>(
  value: string | T | null | undefined,
): string | null {
  return typeof value === "string" ? value : (value?.id ?? null);
}

/**
 * Resolves a refundable payment source from a Stripe invoice
 * PaymentIntent (`pi_…`) or a Charge (`ch_…`), since `refunds.create` must
 * target one or the other.
 *
 * Where that id lives on the invoice varies by Stripe
 * API version and how the invoice was paid, so this probes the known shapes
 * newest-first and returns the first hit.
 */
function extractRefundTargetFromInvoice(invoice: Stripe.Invoice): RefundTarget {
  // Strategy 1 - Modern (Stripe 2024+): payment sources hang off
  // `invoice.payments`. Prefer the PaymentIntent, else the Charge on the same
  // payment. Guard on the `pi_`/`ch_` prefixes because expanded objects can
  // surface unrelated ids.
  for (const invoicePayment of invoice.payments?.data ?? []) {
    const paymentIntentId = getExpandableId(
      invoicePayment.payment.payment_intent,
    );
    if (paymentIntentId?.startsWith("pi_")) {
      return { paymentIntentId, chargeId: null };
    }

    const chargeId = getExpandableId(invoicePayment.payment.charge);
    if (chargeId?.startsWith("ch_")) {
      return { paymentIntentId: null, chargeId };
    }
  }

  // Strategy 2 - no payments array, but the invoice carries a
  // confirmation_secret. Its client_secret has the form `pi_…_secret_…`, so the
  // segment before "_secret_" is the PaymentIntent id.
  const confirmationSecret = invoice.confirmation_secret?.client_secret ?? null;
  const paymentIntentFromSecret =
    confirmationSecret?.split("_secret_")[0] ?? null;
  if (paymentIntentFromSecret?.startsWith("pi_")) {
    return { paymentIntentId: paymentIntentFromSecret, chargeId: null };
  }

  // Strategy 3 - legacy shape (pre-2024): the PaymentIntent sat directly on the
  // invoice. Not in the current SDK types, hence the LegacyInvoice cast
  const legacyInvoice = invoice as LegacyInvoice;
  const legacyPaymentIntentId = getExpandableId(legacyInvoice.payment_intent);
  if (legacyPaymentIntentId?.startsWith("pi_")) {
    return { paymentIntentId: legacyPaymentIntentId, chargeId: null };
  }

  // Strategy 4 - legacy shape: some invoices only expose the Charge id directly
  const legacyChargeId = getExpandableId(legacyInvoice.charge);
  if (legacyChargeId?.startsWith("ch_")) {
    return { paymentIntentId: null, chargeId: legacyChargeId };
  }

  // Nothing usable on this invoice - caller escalates to the other lookups.
  return { paymentIntentId: null, chargeId: null };
}

/**
 * Cancels a student's active subscription in both Stripe and Supabase. It is
 * assumed that `requireRole([1])` + ownership checks have been run. Any pending
 * plan-change schedule is released before cancelling.
 *
 * Two modes:
 *   - refund=false (default): soft cancel - set `cancel_at_period_end` in
 *     Stripe and stamp `cancelled_at` in the DB while leaving
 *     `status = "active"`, so access continues until period end
 *   - refund=true: refund the latest payment and cancel immediately
 *
 * @param supabase - Request-scoped Supabase client
 * @param input.accountId - Owning account of the subscription
 * @param input.studentId - Student whose subscription is being cancelled
 * @param input.refund - true to refund + cancel immediately, false to cancel at
 *   period end
 * @returns `{ ok: true }` on success, or `{ ok: false, status, error }`
 */
export async function cancelSubscription(
  supabase: SupabaseClient<Database>,
  input: { accountId: string; studentId: string; refund: boolean },
): Promise<CancelSubscriptionResult> {
  const { accountId, studentId, refund: requestRefund } = input;

  // Find the active subscription record in Supabase
  const { data: subscription } = await supabase
    .from("student_subscriptions")
    .select("id, pending_stripe_schedule_id, current_period_start")
    .eq("student_id", studentId)
    .eq("status", "active")
    .order("current_period_end", { ascending: false })
    .limit(1)
    .single();

  if (!subscription) {
    return { ok: false, status: 404, error: "No active subscription found" };
  }

  // Guard: refund is only valid within the 28-day window
  if (requestRefund) {
    if (!isWithinRefundWindow(subscription.current_period_start)) {
      return { ok: false, status: 403, error: "Refund window has expired" };
    }
  }

  // Resolve Stripe customer
  const stripeCustomerId = await getStripeCustomerIdForAccount({
    supabase,
    accountId,
  });
  if (!stripeCustomerId) {
    return { ok: false, status: 404, error: "No Stripe customer found" };
  }

  // Find the live Stripe sub by metadata.student_id
  const stripeSubscription = await findActiveStripeSubscriptionByStudent({
    customerId: stripeCustomerId,
    studentId,
  });

  if (!stripeSubscription) {
    return { ok: false, status: 404, error: "No Stripe subscription found" };
  }

  // If there's a a pending upgrade/downgrade SubscriptionSchedule, release it
  // before cancelling
  if (subscription.pending_stripe_schedule_id) {
    await stripe.subscriptionSchedules.release(
      subscription.pending_stripe_schedule_id,
    );
  }

  // Option refund=true: Refund + Immediate Cancel
  if (requestRefund) {
    // Retrieve latest invoice and resolve a refundable payment source.
    const latestInvoiceId =
      typeof stripeSubscription.latest_invoice === "string"
        ? stripeSubscription.latest_invoice
        : stripeSubscription.latest_invoice?.id;

    if (!latestInvoiceId) {
      return {
        ok: false,
        status: 422,
        error: "Could not locate invoice to refund",
      };
    }

    const invoice = await stripe.invoices.retrieve(latestInvoiceId, {
      expand: [
        "payments.data.payment.payment_intent",
        "payments.data.payment.charge",
      ],
    });

    let refundTarget = extractRefundTargetFromInvoice(invoice);

    // If the invoice payload didn't include payment mappings,
    // query them directly.
    if (!refundTarget.paymentIntentId && !refundTarget.chargeId) {
      const invoicePayments = await stripe.invoicePayments.list({
        invoice: latestInvoiceId,
        limit: 10,
        status: "paid",
        expand: ["data.payment.payment_intent", "data.payment.charge"],
      });

      for (const invoicePayment of invoicePayments.data) {
        const paymentIntentId = getExpandableId(
          invoicePayment.payment.payment_intent,
        );
        if (paymentIntentId?.startsWith("pi_")) {
          refundTarget = { paymentIntentId, chargeId: null };
          break;
        }

        const chargeId = getExpandableId(invoicePayment.payment.charge);
        if (chargeId?.startsWith("ch_")) {
          refundTarget = { paymentIntentId: null, chargeId };
          break;
        }
      }
    }

    // Last fallback: find a paid invoice on this subscription and read its
    // payment mapping.
    if (!refundTarget.paymentIntentId && !refundTarget.chargeId) {
      const paidInvoices = await stripe.invoices.list({
        subscription: stripeSubscription.id,
        status: "paid",
        limit: 5,
        expand: [
          "data.payments.data.payment.payment_intent",
          "data.payments.data.payment.charge",
        ],
      });

      for (const paidInvoice of paidInvoices.data) {
        const target = extractRefundTargetFromInvoice(paidInvoice);
        if (target.paymentIntentId || target.chargeId) {
          refundTarget = target;
          break;
        }
      }
    }

    if (!refundTarget.paymentIntentId && !refundTarget.chargeId) {
      console.error("cancel (refund): no refundable payment source found", {
        stripeSubscriptionId: stripeSubscription.id,
        latestInvoiceId,
      });
      return {
        ok: false,
        status: 422,
        error: "Could not locate payment to refund",
      };
    }

    const refundParams: Stripe.RefundCreateParams = {
      reason: "requested_by_customer",
      ...(refundTarget.paymentIntentId
        ? { payment_intent: refundTarget.paymentIntentId }
        : { charge: refundTarget.chargeId! }),
    };

    await stripe.refunds.create(refundParams);

    // Immediately cancel the subscription in Stripe
    await stripe.subscriptions.cancel(stripeSubscription.id);

    // Mark as cancelled immediately in DB
    const { error: updateError } = await supabase
      .from("student_subscriptions")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        pending_plan_id: null,
        pending_stripe_schedule_id: null,
        pending_effective_date: null,
        pending_created_at: null,
      })
      .eq("id", subscription.id);

    if (updateError) {
      console.error(
        "cancel (refund): error updating student_subscriptions:",
        updateError,
      );
    }
    // Option refund=false: Soft cancel at period end
  } else {
    // Schedule cancellation at period end - access preserved until then
    await stripe.subscriptions.update(stripeSubscription.id, {
      cancel_at_period_end: true,
    });

    // Mark scheduled cancellation in DB - status stays "active" so access is
    // preserved
    const { error: updateError } = await supabase
      .from("student_subscriptions")
      .update({
        cancelled_at: new Date().toISOString(),
        pending_plan_id: null,
        pending_stripe_schedule_id: null,
        pending_effective_date: null,
        pending_created_at: null,
      })
      .eq("id", subscription.id);

    if (updateError) {
      console.error(
        "cancel: error updating student_subscriptions:",
        updateError,
      );
    }
  }

  return { ok: true };
}
