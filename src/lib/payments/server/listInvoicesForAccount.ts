import "server-only";

import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { stripe } from "@/src/services/stripe/client";
import type { Database } from "@/src/services/supabase/types/database";
import { getStripeCustomerIdForAccount } from "./getStripeCustomerIdForAccount";

/** One invoice as exposed to the client. Amounts are in minor units (cents). */
export type InvoiceDTO = {
  id: string;
  number: string | null;
  date: string; // ISO 8601
  total: number; // cents
  currency: string; // lowercase ISO, e.g. "cad"
  status: Stripe.Invoice.Status | null;
  hostedInvoiceUrl: string | null;
  invoicePdf: string | null;
};

type ListInvoicesResult =
  | {
      ok: true;
      invoices: InvoiceDTO[];
      hasMore: boolean;
      /** Cursor to pass as `startingAfter` for the next page, else null. */
      nextCursor: string | null;
    }
  | { ok: false; status: number; error: string };

/**
 * Invoice statuses a customer should see in their billing history. `draft`
 * (never finalized) and `void` are hidden. `void` invoices are left behind by
 * abandoned checkouts. Both represent nothing owed or paid, so we hide
 * them the way Stripe's own customer portal does.
 */
const DISPLAYABLE_STATUSES: ReadonlySet<Stripe.Invoice.Status> = new Set([
  "open",
  "paid",
  "uncollectible",
]);

/**
 * Lists the account's Stripe invoices (most-recent first), one page at a time.
 * Invoices are per Stripe customer = per account, so no studentId is involved.
 *
 * Returns an empty list (without hitting Stripe) when the account never had a
 * Stripe customer created. Unexpected Stripe errors are allowed to throw so the
 * calling route can map them to a status via `stripeErrorStatus`.
 */
export async function listInvoicesForAccount({
  supabase,
  accountId,
  limit,
  startingAfter,
}: {
  supabase: SupabaseClient<Database>;
  accountId: string;
  limit: number;
  startingAfter?: string;
}): Promise<ListInvoicesResult> {
  const customerId = await getStripeCustomerIdForAccount({
    supabase,
    accountId,
  });

  if (!customerId) {
    return { ok: true, invoices: [], hasMore: false, nextCursor: null };
  }

  // Stripe can't filter by status server-side (only match a single status), and
  // abandoned checkouts leave many `void` invoices behind. Draining a full
  // Stripe page per hop keeps a display page dense instead of near-empty after
  // filtering - otherwise 10 raw invoices could collapse to 1-2 visible rows.
  const FETCH_WINDOW = 100; // Stripe's max page size.
  const MAX_HOPS = 5; // ≤500 raw scanned;

  const displayable: Stripe.Invoice[] = [];
  let cursor = startingAfter;
  let rawHasMore = false;

  for (let hop = 0; hop < MAX_HOPS; hop++) {
    const page = await stripe.invoices.list({
      customer: customerId,
      limit: FETCH_WINDOW,
      ...(cursor ? { starting_after: cursor } : {}),
    });
    rawHasMore = page.has_more;

    for (const inv of page.data) {
      if (inv.id && inv.status && DISPLAYABLE_STATUSES.has(inv.status)) {
        displayable.push(inv);
      }
    }

    const lastRaw = page.data.at(-1);
    if (lastRaw?.id) cursor = lastRaw.id;

    // One displayable past `limit` is enough to fill the page AND prove there's
    // a next page — stop early to avoid needless Stripe calls.
    if (displayable.length > limit || !page.has_more) break;
  }

  const pageItems = displayable.slice(0, limit);
  const hasMore =
    displayable.length > limit || (rawHasMore && pageItems.length === limit);

  // Cursor is the last RETURNED invoice's id (not the last raw item): over-fetch
  // may scan past what we return, so paging must resume from the last row the
  // client actually saw. Stripe orders by `created` desc, so `starting_after`
  // this id continues correctly.
  const nextCursor =
    hasMore && pageItems.length > 0 ? (pageItems.at(-1)?.id ?? null) : null;

  return {
    ok: true,
    invoices: pageItems.map(toInvoiceDTO),
    hasMore,
    nextCursor,
  };
}

function toInvoiceDTO(inv: Stripe.Invoice): InvoiceDTO {
  return {
    id: inv.id ?? "",
    number: inv.number ?? null,
    date: new Date(inv.created * 1000).toISOString(),
    total: inv.total,
    currency: inv.currency,
    status: inv.status,
    hostedInvoiceUrl: inv.hosted_invoice_url ?? null,
    invoicePdf: inv.invoice_pdf ?? null,
  };
}
