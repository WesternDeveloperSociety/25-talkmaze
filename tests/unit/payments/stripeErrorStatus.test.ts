import { describe, it, expect } from "vitest";
import Stripe from "stripe";
import { stripeErrorStatus } from "@/src/lib/payments/server/stripeErrorStatus";

describe("stripeErrorStatus", () => {
  it("maps a Stripe rate-limit error to 429 with Retry-After", () => {
    const err = new Stripe.errors.StripeRateLimitError({ message: "slow down" });
    expect(stripeErrorStatus(err)).toEqual({ status: 429, retryAfter: 10 });
  });

  it("maps a Stripe connection timeout to 504 with Retry-After", () => {
    const err = new Stripe.errors.StripeConnectionError({
      message: "Request aborted due to timeout being reached",
    });
    expect(stripeErrorStatus(err)).toEqual({ status: 504, retryAfter: 10 });
  });

  it("maps a non-timeout connection error to 503 with Retry-After", () => {
    const err = new Stripe.errors.StripeConnectionError({
      message: "socket hang up",
    });
    expect(stripeErrorStatus(err)).toEqual({ status: 503, retryAfter: 10 });
  });

  it("maps a Stripe-side API error to 503 with Retry-After", () => {
    const err = new Stripe.errors.StripeAPIError({ message: "server error" });
    expect(stripeErrorStatus(err)).toEqual({ status: 503, retryAfter: 10 });
  });

  it("maps our own / Supabase / unknown errors to 500 (no Retry-After)", () => {
    expect(stripeErrorStatus(new Error("db down"))).toEqual({ status: 500 });
    expect(stripeErrorStatus("nope")).toEqual({ status: 500 });
    expect(
      stripeErrorStatus(
        new Stripe.errors.StripeInvalidRequestError({ message: "bad param" }),
      ),
    ).toEqual({ status: 500 });
  });
});
