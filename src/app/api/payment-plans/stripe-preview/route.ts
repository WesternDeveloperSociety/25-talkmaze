import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/src/lib/auth/server/requireRole";
import { stripe } from "@/src/services/stripe/client";
import Stripe from "stripe";

const QuerySchema = z.object({ priceId: z.string().min(1) }).strict();

/**
 * GET /api/payment-plans/stripe-preview?priceId=price_xxx
 *
 * Fetches display metadata for a Stripe price without writing anything to the
 * database. Used by the "Add plan" form to auto-populate fields (name, amount,
 * interval) after the admin enters a Stripe Price ID, so they can verify what
 * they're importing before saving.
 *
 * Response: { preview: { product_name, amount, currency, interval, interval_count } }.
 */
export async function GET(req: Request) {
  const auth = await requireRole([3]);
  if (auth instanceof NextResponse) return auth;

  const parsed = QuerySchema.safeParse(
    Object.fromEntries(new URL(req.url).searchParams),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request parameters", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const price = await stripe.prices.retrieve(parsed.data.priceId, {
      expand: ["product"],
    });
    const product = price.product as Stripe.Product;

    return NextResponse.json({
      preview: {
        product_name: product.name,
        amount: price.unit_amount,
        currency: price.currency.toUpperCase(),
        interval: price.recurring?.interval ?? null,
        interval_count: price.recurring?.interval_count ?? null,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Stripe price ID not found" },
      { status: 404 },
    );
  }
}
