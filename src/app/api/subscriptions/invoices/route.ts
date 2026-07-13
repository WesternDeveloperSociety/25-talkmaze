import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/src/lib/auth/server/requireRole";
import { listInvoicesForAccount } from "@/src/lib/payments/server/listInvoicesForAccount";
import { stripeErrorStatus } from "@/src/lib/payments/server/stripeErrorStatus";

const QuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(10),
    startingAfter: z.string().startsWith("in_").optional(),
  })
  .strict();

/**
 * GET /api/subscriptions/invoices
 * Returns the authenticated account's Stripe billing history (invoices),
 * paginated. Account-scoped: the Stripe customer is derived from the caller's
 * own `account` row, so there is no studentId and no ownership check.
 *
 * Query: `limit` (1-100, default 10), `startingAfter` (invoice id cursor).
 * Response: { invoices, hasMore, nextCursor }.
 */
export async function GET(req: Request) {
  // Check Auth
  const auth = await requireRole([1]);
  if (auth instanceof NextResponse) return auth;
  const { user, supabase } = auth;

  // Validate query params
  const parsed = QuerySchema.safeParse(
    Object.fromEntries(new URL(req.url).searchParams),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Execute
  try {
    const result = await listInvoicesForAccount({
      supabase,
      accountId: user.id,
      limit: parsed.data.limit,
      startingAfter: parsed.data.startingAfter,
    });
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }
    return NextResponse.json({
      invoices: result.invoices,
      hasMore: result.hasMore,
      nextCursor: result.nextCursor,
    });
  } catch (err: unknown) {
    console.error("invoices error", err);
    const { status, retryAfter } = stripeErrorStatus(err);
    const error =
      status === 429
        ? "Too many requests"
        : status === 503 || status === 504
          ? "Service temporarily unavailable"
          : "Internal server error";
    return NextResponse.json(
      { error },
      {
        status,
        ...(retryAfter
          ? { headers: { "Retry-After": String(retryAfter) } }
          : {}),
      },
    );
  }
}
