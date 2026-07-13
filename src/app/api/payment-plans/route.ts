import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/src/lib/auth/server/requireRole";
import { stripe } from "@/src/services/stripe/client";
import Stripe from "stripe";

const PostBodySchema = z
  .object({
    stripe_price_id: z.string().min(1),
    classes: z.number().int().positive(),
    name: z.string().min(1),
    renewal: z.string().min(1),
    description: z.string().nullable().optional(),
    type: z.string().nullable().optional(),
  })
  .strict();

export async function GET() {
  const auth = await requireRole([3]);
  if (auth instanceof NextResponse) return auth;
  const { supabase } = auth;

  try {
    const { data: plans, error } = await supabase
      .from("plans")
      .select("id, name, type, classes, cents, currency, renewal, description, stripe_price_id, is_active, created_at")
      .order("cents", { ascending: true });

    if (error) {
      console.error("payment-plans GET error", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }

    // Enrich each plan with live Stripe data in parallel. Individual failures
    // are caught and silently skipped so one bad price ID doesn't break the list.
    const enriched = await Promise.all(
      (plans ?? []).map(async (plan) => {
        try {
          const price = await stripe.prices.retrieve(plan.stripe_price_id, {
            expand: ["product"],
          });
          const product = price.product as Stripe.Product;
          return {
            ...plan,
            stripe_product_name: product.name,
            stripe_amount: price.unit_amount,
            stripe_currency: price.currency,
            stripe_interval: price.recurring?.interval ?? null,
            stripe_interval_count: price.recurring?.interval_count ?? null,
          };
        } catch {
          return { ...plan };
        }
      }),
    );

    return NextResponse.json({ plans: enriched });
  } catch (err: unknown) {
    console.error("payment-plans GET error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  const auth = await requireRole([3]);
  if (auth instanceof NextResponse) return auth;
  const { supabase } = auth;

  const parsed = PostBodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const data = parsed.data;

  try {
    let price: Stripe.Price;
    try {
      price = await stripe.prices.retrieve(data.stripe_price_id, {
        expand: ["product"],
      });
    } catch {
      return NextResponse.json(
        { error: "Stripe price ID not found" },
        { status: 400 },
      );
    }

    const { data: existing } = await supabase
      .from("plans")
      .select("id")
      .eq("stripe_price_id", data.stripe_price_id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "A plan with this Stripe price ID already exists" },
        { status: 409 },
      );
    }

    const { data: plan, error } = await supabase
      .from("plans")
      .insert({
        stripe_price_id: data.stripe_price_id,
        classes: data.classes,
        name: data.name,
        description: data.description ?? null,
        renewal: data.renewal,
        type: data.type ?? null,
        cents: price.unit_amount ?? 0,
        currency: price.currency.toUpperCase(),
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error("payment-plans POST insert error", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }

    const product = price.product as Stripe.Product;
    return NextResponse.json(
      {
        plan: {
          ...plan,
          stripe_product_name: product.name,
          stripe_amount: price.unit_amount,
          stripe_currency: price.currency.toUpperCase(),
          stripe_interval: price.recurring?.interval ?? null,
          stripe_interval_count: price.recurring?.interval_count ?? null,
        },
      },
      { status: 201 },
    );
  } catch (err: unknown) {
    console.error("payment-plans POST error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
