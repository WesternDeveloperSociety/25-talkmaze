/**
 * Contract tests for POST /api/students/[studentId]/subscription/cancel.
 *
 * Five questions (per docs/api-contract.md + test-rewrite-runbook):
 *   Q1 WHO CAN CALL IT?       — ownership only here; role gate lives in _auth-matrix.test.ts
 *   Q2 WHAT INPUTS?           — Zod validation: malformed studentId, unknown fields, refund type
 *   Q3 WHAT DOES IT RETURN?   — { success: true } on success; { error: string } on failure
 *   Q4 WHAT DOES IT PERSIST?  — cancel_at_period_end vs immediate-cancelled state on student_subscriptions
 *   Q5 WHAT EXTERNAL CALLS?   — stripe.subscriptions.update / .cancel / refunds.create with correct args
 *
 * The test is the spec. Routes are RED until they satisfy these assertions.
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

// Stripe mock surface — kept literal at file scope so vitest's hoisting picks
// it up. Helpers in tests/helpers/stripeMocks.ts seed `.mockResolvedValueOnce`
// against this surface per test.
vi.mock("@/src/services/stripe/client", () => ({
  stripe: {
    subscriptions: {
      list: vi.fn(),
      update: vi.fn(),
      cancel: vi.fn(),
    },
    subscriptionSchedules: {
      release: vi.fn(),
    },
    invoices: {
      retrieve: vi.fn(),
      list: vi.fn(),
    },
    invoicePayments: {
      list: vi.fn(),
    },
    refunds: {
      create: vi.fn(),
    },
    customers: {
      retrieve: vi.fn(),
    },
    setupIntents: {
      create: vi.fn(),
    },
  },
}));

import { resetAll } from "@tests/helpers/db";
import { call } from "@tests/helpers/request";
import { server } from "@tests/helpers/msw";
import { expectRowExists, getRow } from "@tests/helpers/sideEffects";
import {
  seedOwnerWithActiveSubscription,
  seedStranger,
} from "@tests/helpers/subscriptionFixtures";
import {
  FAKE_STRIPE_SUB_ID,
  mockStripeSubList,
  mockInvoiceForRefund,
} from "@tests/helpers/stripeMocks";

import { POST as cancelPOST } from "@/src/app/api/students/[studentId]/subscription/cancel/route";
import { stripe } from "@/src/services/stripe/client";

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterAll(() => server.close());
beforeEach(resetAll);
afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});

// ═════════════════════════════════════════════════════════════════════════════
// Q1: WHO CAN CALL IT?
// Role-level gating (401 anon, 403 wrong role) is asserted in _auth-matrix.test.ts.
// Here we cover ownership only: right role, wrong resource.
// ═════════════════════════════════════════════════════════════════════════════

describe("POST /api/students/[studentId]/subscription/cancel — ownership", () => {
  it("returns 403 when the caller does not own the target student", async () => {
    const { student } = await seedOwnerWithActiveSubscription();
    const { cookies: strangerCookies } = await seedStranger();

    const res = await call(cancelPOST, {
      method: "POST",
      cookies: strangerCookies,
      params: { studentId: student.id },
    });
    expect(res.status).toBe(403);

    // No DB mutation — subscription untouched.
    const sub = await getRow("student_subscriptions", { student_id: student.id });
    expect(sub?.status).toBe("active");
    expect(sub?.cancelled_at).toBeNull();
  });

  it("does NOT call Stripe when ownership check fails", async () => {
    const { student } = await seedOwnerWithActiveSubscription();
    const { cookies: strangerCookies } = await seedStranger();

    await call(cancelPOST, {
      method: "POST",
      cookies: strangerCookies,
      params: { studentId: student.id },
    });

    expect(stripe.subscriptions.update).not.toHaveBeenCalled();
    expect(stripe.subscriptions.cancel).not.toHaveBeenCalled();
    expect(stripe.refunds.create).not.toHaveBeenCalled();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Q2: WHAT INPUTS DOES IT ACCEPT?
// ═════════════════════════════════════════════════════════════════════════════

describe("POST /api/students/[studentId]/subscription/cancel — input validation", () => {
  it("returns 400 when studentId is malformed (not a UUID)", async () => {
    const { cookies } = await seedOwnerWithActiveSubscription();

    const res = await call(cancelPOST, {
      method: "POST",
      cookies,
      params: { studentId: "not-a-uuid" },
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when body contains unknown fields (strict)", async () => {
    const { cookies, student } = await seedOwnerWithActiveSubscription();

    const res = await call(cancelPOST, {
      method: "POST",
      cookies,
      params: { studentId: student.id }, body: { extraneous: "field" },
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when refund is a non-boolean", async () => {
    const { cookies, student } = await seedOwnerWithActiveSubscription();

    const res = await call(cancelPOST, {
      method: "POST",
      cookies,
      params: { studentId: student.id }, body: { refund: "yes" },
    });
    expect(res.status).toBe(400);
  });

  it("error responses use the { error: string } shape", async () => {
    const { cookies } = await seedOwnerWithActiveSubscription();

    const res = await call(cancelPOST, {
      method: "POST",
      cookies,
      params: { studentId: "not-a-uuid" },
    });
    const body = await res.json<{ error?: string; message?: string; status?: number }>();
    expect(typeof body.error).toBe("string");
    expect(body.message).toBeUndefined();
    expect(body.status).toBeUndefined();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Q3: WHAT DOES IT RETURN ON SUCCESS?
// ═════════════════════════════════════════════════════════════════════════════

describe("POST /api/students/[studentId]/subscription/cancel — response shape", () => {
  it("returns { success: true } on schedule-at-period-end", async () => {
    const { cookies, student } = await seedOwnerWithActiveSubscription();
    mockStripeSubList(student.id);

    const res = await call(cancelPOST, {
      method: "POST",
      cookies,
      params: { studentId: student.id }, body: { refund: false },
    });
    expect(res.status).toBe(200);
    const body = await res.json<{ success: boolean }>();
    expect(body).toEqual({ success: true });
  });

  it("returns { success: true } on immediate refund + cancel", async () => {
    const { cookies, student } = await seedOwnerWithActiveSubscription();
    mockStripeSubList(student.id);
    mockInvoiceForRefund();

    const res = await call(cancelPOST, {
      method: "POST",
      cookies,
      params: { studentId: student.id }, body: { refund: true },
    });
    expect(res.status).toBe(200);
    const body = await res.json<{ success: boolean }>();
    expect(body).toEqual({ success: true });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Q4: WHAT DOES IT PERSIST?
// ═════════════════════════════════════════════════════════════════════════════

describe("POST /api/students/[studentId]/subscription/cancel — side effects", () => {
  it("schedule-at-period-end sets cancelled_at but keeps status='active'", async () => {
    const { cookies, student, subscription } = await seedOwnerWithActiveSubscription();
    mockStripeSubList(student.id);

    await call(cancelPOST, {
      method: "POST",
      cookies,
      params: { studentId: student.id }, body: { refund: false },
    });

    const row = await expectRowExists("student_subscriptions", { id: subscription.id });
    expect(row.status).toBe("active");
    expect(row.cancelled_at).not.toBeNull();
  });

  it("refund=true marks status='cancelled' and clears pending_* fields", async () => {
    const { cookies, student, subscription } = await seedOwnerWithActiveSubscription({
      pendingScheduleId: "sub_sched_pending",
    });
    mockStripeSubList(student.id);
    mockInvoiceForRefund();

    await call(cancelPOST, {
      method: "POST",
      cookies,
      params: { studentId: student.id }, body: { refund: true },
    });

    const row = await expectRowExists("student_subscriptions", { id: subscription.id });
    expect(row.status).toBe("cancelled");
    expect(row.cancelled_at).not.toBeNull();
    expect(row.pending_stripe_schedule_id).toBeNull();
    expect(row.pending_plan_id).toBeNull();
    expect(row.pending_effective_date).toBeNull();
  });

  it("returns 403 and does NOT write when refund window has expired", async () => {
    const { cookies, student, subscription } = await seedOwnerWithActiveSubscription({
      periodStartDaysAgo: 29,
    });

    const res = await call(cancelPOST, {
      method: "POST",
      cookies,
      params: { studentId: student.id }, body: { refund: true },
    });
    expect(res.status).toBe(403);

    const row = await expectRowExists("student_subscriptions", { id: subscription.id });
    expect(row.status).toBe("active");
    expect(row.cancelled_at).toBeNull();
  });

  it("returns 404 and does NOT write when no active subscription exists", async () => {
    // Owner is set up but has no subscription row at all.
    const { cookies, student } = await seedOwnerWithActiveSubscription();
    // Delete the seeded subscription to simulate the "no sub" state for this student.
    const { createClient } = await import("@supabase/supabase-js");
    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    await db.from("student_subscriptions").delete().eq("student_id", student.id);

    const res = await call(cancelPOST, {
      method: "POST",
      cookies,
      params: { studentId: student.id },
    });
    expect(res.status).toBe(404);

    expect(stripe.subscriptions.update).not.toHaveBeenCalled();
    expect(stripe.subscriptions.cancel).not.toHaveBeenCalled();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Q5: WHAT EXTERNAL CALLS DID IT MAKE?
// ═════════════════════════════════════════════════════════════════════════════

describe("POST /api/students/[studentId]/subscription/cancel — external calls", () => {
  it("schedule-at-period-end calls stripe.subscriptions.update with cancel_at_period_end=true", async () => {
    const { cookies, student } = await seedOwnerWithActiveSubscription();
    mockStripeSubList(student.id);

    await call(cancelPOST, {
      method: "POST",
      cookies,
      params: { studentId: student.id }, body: { refund: false },
    });

    expect(stripe.subscriptions.update).toHaveBeenCalledTimes(1);
    expect(stripe.subscriptions.update).toHaveBeenCalledWith(
      FAKE_STRIPE_SUB_ID,
      expect.objectContaining({ cancel_at_period_end: true }),
    );
    expect(stripe.subscriptions.cancel).not.toHaveBeenCalled();
    expect(stripe.refunds.create).not.toHaveBeenCalled();
  });

  it("refund=true calls stripe.refunds.create then stripe.subscriptions.cancel", async () => {
    const { cookies, student } = await seedOwnerWithActiveSubscription();
    mockStripeSubList(student.id);
    mockInvoiceForRefund();

    await call(cancelPOST, {
      method: "POST",
      cookies,
      params: { studentId: student.id }, body: { refund: true },
    });

    expect(stripe.refunds.create).toHaveBeenCalledTimes(1);
    expect(stripe.refunds.create).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "requested_by_customer" }),
    );
    expect(stripe.subscriptions.cancel).toHaveBeenCalledTimes(1);
    expect(stripe.subscriptions.cancel).toHaveBeenCalledWith(FAKE_STRIPE_SUB_ID);
  });

  it("releases pending_stripe_schedule_id before cancelling when one exists", async () => {
    const { cookies, student } = await seedOwnerWithActiveSubscription({
      pendingScheduleId: "sub_sched_to_release",
    });
    mockStripeSubList(student.id);

    await call(cancelPOST, {
      method: "POST",
      cookies,
      params: { studentId: student.id }, body: { refund: false },
    });

    expect(stripe.subscriptionSchedules.release).toHaveBeenCalledWith(
      "sub_sched_to_release",
    );
  });
});
