/**
 * Contract tests for GET /api/subscriptions/invoices.
 *
 * Five questions (per docs/api-contract.md + test-rewrite-runbook):
 *   Q1 WHO CAN CALL IT?       — role gate ([1]) lives in _auth-matrix.test.ts. Account-scoped;
 *                               no per-resource ownership (customer derived from caller's account).
 *   Q2 WHAT INPUTS?           — Zod query validation: limit bounds, startingAfter cursor shape.
 *   Q3 WHAT DOES IT RETURN?   — { invoices, hasMore, nextCursor }; drafts + voids filtered; { error } on failure.
 *   Q4 WHAT DOES IT PERSIST?  — nothing (read-only).
 *   Q5 WHAT EXTERNAL CALLS?   — stripe.invoices.list with { customer, limit: 100 } (a fixed fetch
 *                               window, over-fetched across pages to fill the display limit after
 *                               filtering); NOT called when no customer. Errors map to 429/503/504/500.
 */
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  vi,
} from "vitest";

// Stripe mock surface — literal at file scope for vitest hoisting.
vi.mock("@/src/services/stripe/client", () => ({
  stripe: {
    invoices: { list: vi.fn() },
    customers: { create: vi.fn() },
  },
}));

import Stripe from "stripe";
import { resetAll } from "@tests/helpers/db";
import { call } from "@tests/helpers/request";
import { server } from "@tests/helpers/msw";
import {
  seedOwnerWithActiveSubscription,
  seedStranger,
} from "@tests/helpers/subscriptionFixtures";
import { FAKE_CUSTOMER_ID } from "@tests/helpers/stripeMocks";

import { GET as invoicesGET } from "@/src/app/api/subscriptions/invoices/route";
import { stripe } from "@/src/services/stripe/client";

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterAll(() => server.close());
beforeEach(resetAll);
afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});

// Fake invoice payload shaped like a Stripe.Invoice. `over` customizes fields.
function fakeInvoice(over: Record<string, unknown> = {}) {
  return {
    id: "in_paid_1",
    number: "TM-0001",
    created: 1_718_000_000,
    total: 14986,
    currency: "cad",
    status: "paid",
    hosted_invoice_url: "https://invoice.stripe.com/i/in_paid_1",
    invoice_pdf: "https://invoice.stripe.com/i/in_paid_1.pdf",
    ...over,
  };
}

function mockList(
  data: Array<Record<string, unknown>>,
  hasMore = false,
) {
  vi.mocked(stripe.invoices.list).mockResolvedValueOnce({
    data,
    has_more: hasMore,
  } as Awaited<ReturnType<typeof stripe.invoices.list>>);
}

// ═════════════════════════════════════════════════════════════════════════════
// Q2: WHAT INPUTS DOES IT ACCEPT?
// ═════════════════════════════════════════════════════════════════════════════

describe("GET /api/subscriptions/invoices — input validation", () => {
  it("returns 400 when limit is not a number", async () => {
    const { cookies } = await seedOwnerWithActiveSubscription();
    const res = await call(invoicesGET, { cookies, query: { limit: "abc" } });
    expect(res.status).toBe(400);
  });

  it("returns 400 when limit is below 1", async () => {
    const { cookies } = await seedOwnerWithActiveSubscription();
    const res = await call(invoicesGET, { cookies, query: { limit: "0" } });
    expect(res.status).toBe(400);
  });

  it("returns 400 when limit exceeds 100", async () => {
    const { cookies } = await seedOwnerWithActiveSubscription();
    const res = await call(invoicesGET, { cookies, query: { limit: "500" } });
    expect(res.status).toBe(400);
  });

  it("returns 400 when startingAfter is not an invoice id", async () => {
    const { cookies } = await seedOwnerWithActiveSubscription();
    const res = await call(invoicesGET, {
      cookies,
      query: { startingAfter: "not-an-invoice" },
    });
    expect(res.status).toBe(400);
  });

  it("defaults the display limit to 10 when omitted", async () => {
    const { cookies } = await seedOwnerWithActiveSubscription();
    // 11 displayable invoices in one Stripe page → the default returns 10.
    mockList(
      Array.from({ length: 11 }, (_, i) =>
        fakeInvoice({ id: `in_paid_${i}`, status: "paid" }),
      ),
    );
    const res = await call(invoicesGET, { cookies });
    expect(res.status).toBe(200);
    const body = await res.json<{ invoices: unknown[]; hasMore: boolean }>();
    expect(body.invoices).toHaveLength(10);
    expect(body.hasMore).toBe(true);
  });

  it("error responses use the { error: string } shape only", async () => {
    const { cookies } = await seedOwnerWithActiveSubscription();
    const res = await call(invoicesGET, { cookies, query: { limit: "abc" } });
    const body = await res.json<{
      error?: string;
      message?: string;
      status?: number;
    }>();
    expect(typeof body.error).toBe("string");
    expect(body.message).toBeUndefined();
    expect(body.status).toBeUndefined();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Q3: WHAT DOES IT RETURN?
// ═════════════════════════════════════════════════════════════════════════════

describe("GET /api/subscriptions/invoices — response shape", () => {
  it("returns mapped invoices, filters drafts and voids, and reports pagination", async () => {
    const { cookies } = await seedOwnerWithActiveSubscription();
    // One Stripe page holding 3 displayable (paid, open, paid) plus a void and
    // a draft. With display limit=2 the loop breaks after this single page (it
    // already has more displayable than requested) — so only one Stripe call.
    mockList(
      [
        fakeInvoice(),
        fakeInvoice({
          id: "in_open_2",
          number: "TM-0002",
          created: 1_717_000_000,
          total: 3164,
          status: "open",
          hosted_invoice_url: "https://invoice.stripe.com/i/in_open_2",
        }),
        fakeInvoice({ id: "in_void_3", status: "void" }),
        fakeInvoice({ id: "in_draft_4", status: "draft" }),
        fakeInvoice({ id: "in_paid_5", status: "paid" }),
      ],
      true,
    );

    const res = await call(invoicesGET, { cookies, query: { limit: "2" } });
    expect(res.status).toBe(200);
    const body = await res.json<{
      invoices: Array<{
        id: string;
        total: number;
        currency: string;
        status: string;
        date: string;
        hostedInvoiceUrl: string | null;
      }>;
      hasMore: boolean;
      nextCursor: string | null;
    }>();

    // Void and draft are filtered out; the page is sliced to the display limit.
    expect(stripe.invoices.list).toHaveBeenCalledTimes(1);
    expect(body.invoices).toHaveLength(2);
    expect(body.invoices.map((i) => i.id)).toEqual(["in_paid_1", "in_open_2"]);

    // Field mapping.
    expect(body.invoices[0]).toMatchObject({
      id: "in_paid_1",
      total: 14986,
      currency: "cad",
      status: "paid",
      hostedInvoiceUrl: "https://invoice.stripe.com/i/in_paid_1",
    });
    expect(body.invoices[0].date).toBe(
      new Date(1_718_000_000 * 1000).toISOString(),
    );

    // Pagination: a 3rd displayable invoice exists beyond the limit, so hasMore
    // is true and the cursor is the LAST RETURNED invoice (not a raw draft/void).
    expect(body.hasMore).toBe(true);
    expect(body.nextCursor).toBe("in_open_2");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Q5: WHAT EXTERNAL CALLS DID IT MAKE?
// ═════════════════════════════════════════════════════════════════════════════

describe("GET /api/subscriptions/invoices — external calls", () => {
  it("lists invoices for the account's Stripe customer", async () => {
    const { cookies } = await seedOwnerWithActiveSubscription();
    mockList([fakeInvoice()]);

    await call(invoicesGET, { cookies, query: { limit: "5" } });

    expect(stripe.invoices.list).toHaveBeenCalledTimes(1);
    // Stripe is queried with the internal fetch window (100), not the display
    // limit — the display limit is applied after status filtering.
    expect(stripe.invoices.list).toHaveBeenCalledWith(
      expect.objectContaining({ customer: FAKE_CUSTOMER_ID, limit: 100 }),
    );
  });

  it("passes starting_after through when a cursor is supplied", async () => {
    const { cookies } = await seedOwnerWithActiveSubscription();
    mockList([fakeInvoice()]);

    await call(invoicesGET, {
      cookies,
      query: { startingAfter: "in_cursor_9" },
    });

    expect(stripe.invoices.list).toHaveBeenCalledWith(
      expect.objectContaining({ starting_after: "in_cursor_9" }),
    );
  });

  it("returns an empty list WITHOUT calling Stripe when the account has no customer", async () => {
    const { cookies } = await seedStranger(); // role 1, no stripe_customer_id

    const res = await call(invoicesGET, { cookies });
    expect(res.status).toBe(200);
    const body = await res.json<{ invoices: unknown[]; hasMore: boolean }>();
    expect(body.invoices).toEqual([]);
    expect(body.hasMore).toBe(false);
    expect(stripe.invoices.list).not.toHaveBeenCalled();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Upstream-failure statuses (this route only — see docs/api-contract.md).
// ═════════════════════════════════════════════════════════════════════════════

describe("GET /api/subscriptions/invoices — upstream failures", () => {
  it("maps a Stripe connection error to 503 with Retry-After", async () => {
    const { cookies } = await seedOwnerWithActiveSubscription();
    vi.mocked(stripe.invoices.list).mockRejectedValueOnce(
      new Stripe.errors.StripeConnectionError({ message: "socket hang up" }),
    );

    const res = await call(invoicesGET, { cookies });
    expect(res.status).toBe(503);
    expect(res.headers.get("Retry-After")).toBe("10");
  });

  it("maps a Stripe rate-limit error to 429", async () => {
    const { cookies } = await seedOwnerWithActiveSubscription();
    vi.mocked(stripe.invoices.list).mockRejectedValueOnce(
      new Stripe.errors.StripeRateLimitError({ message: "slow down" }),
    );

    const res = await call(invoicesGET, { cookies });
    expect(res.status).toBe(429);
  });

  it("maps a Stripe API error to 503", async () => {
    const { cookies } = await seedOwnerWithActiveSubscription();
    vi.mocked(stripe.invoices.list).mockRejectedValueOnce(
      new Stripe.errors.StripeAPIError({ message: "stripe is down" }),
    );

    const res = await call(invoicesGET, { cookies });
    expect(res.status).toBe(503);
  });

  it("maps an unexpected (non-Stripe) error to 500", async () => {
    const { cookies } = await seedOwnerWithActiveSubscription();
    vi.mocked(stripe.invoices.list).mockRejectedValueOnce(
      new Error("something we broke"),
    );

    const res = await call(invoicesGET, { cookies });
    expect(res.status).toBe(500);
    expect(res.headers.get("Retry-After")).toBeNull();
  });
});
