import Stripe from "stripe";

/**
 * The HTTP status a Stripe upstream failure maps to. `retryAfter` is in seconds
 * and, when present, the route emits it as a `Retry-After` header.
 */
export type UpstreamErrorStatus = { status: number; retryAfter?: number };

const RETRY_AFTER_SECONDS = 10;

/**
 * Maps a caught error from a Stripe SDK call to the HTTP status the invoices
 * route should return. Pure and framework-free so it can be unit-tested and
 * reused.
 *
 * - Rate-limited by Stripe            -> 429 (retryable)
 * - Connection failure / timeout      -> 503 / 504 (transient, retryable)
 * - Stripe-side API error (their 5xx) -> 503 (transient, retryable)
 * - Anything else (our bug, Supabase,
 *   bad request, auth misconfig)      -> 500
 * @param err - The value thrown by a `stripe.*` SDK call, caught as `unknown`.
 * @returns The HTTP status to return, plus `retryAfter` seconds for transient
 *  failures.
 */
export function stripeErrorStatus(err: unknown): UpstreamErrorStatus {
  if (err instanceof Stripe.errors.StripeRateLimitError) {
    return { status: 429, retryAfter: RETRY_AFTER_SECONDS };
  }
  if (err instanceof Stripe.errors.StripeConnectionError) {
    // The Stripe node SDK has no dedicated timeout class; request timeouts
    // surface as a StripeConnectionError whose message mentions "timeout".
    return isTimeout(err)
      ? { status: 504, retryAfter: RETRY_AFTER_SECONDS }
      : { status: 503, retryAfter: RETRY_AFTER_SECONDS };
  }
  if (err instanceof Stripe.errors.StripeAPIError) {
    return { status: 503, retryAfter: RETRY_AFTER_SECONDS };
  }
  return { status: 500 };
}

function isTimeout(err: Stripe.errors.StripeConnectionError): boolean {
  return /time\s*out|ETIMEDOUT|ESOCKETTIMEDOUT/i.test(err.message ?? "");
}
