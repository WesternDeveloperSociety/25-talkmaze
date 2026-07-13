/**
 * Contract tests for POST /api/students/[studentId]/subscription/resume.
 *
 * Resumes auto-renewal for a subscription previously scheduled to cancel at
 * period end (i.e. status='active' AND cancelled_at IS NOT NULL).
 *
 * Five questions (per docs/api-contract.md + test-rewrite-runbook):
 *   Q1 WHO CAN CALL IT?       — ownership only; role gate lives in _auth-matrix.test.ts
 *   Q2 WHAT INPUTS?           — Zod: malformed studentId, unknown fields
 *   Q3 WHAT DOES IT RETURN?   — { success: true }
 *   Q4 WHAT DOES IT PERSIST?  — cancelled_at cleared to null, status stays "active"
 *   Q5 WHAT EXTERNAL CALLS?   — stripe.subscriptions.update with cancel_at_period_end: false
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

vi.mock("@/src/services/stripe/client", () => ({
  stripe: {
    subscriptions: {
      list: vi.fn(),
      update: vi.fn(),
      cancel: vi.fn(),
    },
    subscriptionSchedules: { release: vi.fn() },
    invoices: { retrieve: vi.fn(), list: vi.fn() },
    invoicePayments: { list: vi.fn() },
    refunds: { create: vi.fn() },
    customers: { retrieve: vi.fn() },
    setupIntents: { create: vi.fn() },
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
import { FAKE_STRIPE_SUB_ID, mockStripeSubList } from "@tests/helpers/stripeMocks";

import { POST as resumePOST } from "@/src/app/api/students/[studentId]/subscription/resume/route";
import { stripe } from "@/src/services/stripe/client";

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterAll(() => server.close());
beforeEach(resetAll);
afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});

const PAST_ISO = new Date(Date.now() - 60 * 60 * 1000).toISOString();

// ═════════════════════════════════════════════════════════════════════════════
// Q1: WHO CAN CALL IT?
// ═════════════════════════════════════════════════════════════════════════════

describe("POST /api/students/[studentId]/subscription/resume — ownership", () => {
  it("returns 403 when the caller does not own the target student", async () => {
    const { student, subscription } = await seedOwnerWithActiveSubscription({
      cancelledAt: PAST_ISO,
    });
    const { cookies: strangerCookies } = await seedStranger();

    const res = await call(resumePOST, {
      method: "POST",
      cookies: strangerCookies,
      params: { studentId: student.id },
    });
    expect(res.status).toBe(403);

    // cancelled_at still set — no resume happened.
    const row = await expectRowExists("student_subscriptions", { id: subscription.id });
    expect(row.cancelled_at).not.toBeNull();
  });

  it("does NOT call Stripe when ownership check fails", async () => {
    const { student } = await seedOwnerWithActiveSubscription({ cancelledAt: PAST_ISO });
    const { cookies: strangerCookies } = await seedStranger();

    await call(resumePOST, {
      method: "POST",
      cookies: strangerCookies,
      params: { studentId: student.id },
    });

    expect(stripe.subscriptions.update).not.toHaveBeenCalled();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Q2: WHAT INPUTS DOES IT ACCEPT?
// ═════════════════════════════════════════════════════════════════════════════

describe("POST /api/students/[studentId]/subscription/resume — input validation", () => {
  it("returns 400 when studentId is malformed (not a UUID)", async () => {
    const { cookies } = await seedOwnerWithActiveSubscription({ cancelledAt: PAST_ISO });

    const res = await call(resumePOST, {
      method: "POST",
      cookies,
      params: { studentId: "not-a-uuid" },
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when body contains unknown fields (strict)", async () => {
    const { cookies, student } = await seedOwnerWithActiveSubscription({
      cancelledAt: PAST_ISO,
    });

    const res = await call(resumePOST, {
      method: "POST",
      cookies,
      params: { studentId: student.id }, body: { extraneous: "field" },
    });
    expect(res.status).toBe(400);
  });

  it("error responses use the { error: string } shape", async () => {
    const { cookies } = await seedOwnerWithActiveSubscription({ cancelledAt: PAST_ISO });

    const res = await call(resumePOST, {
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

describe("POST /api/students/[studentId]/subscription/resume — response shape", () => {
  it("returns { success: true } when resuming a cancellation-scheduled sub", async () => {
    const { cookies, student } = await seedOwnerWithActiveSubscription({
      cancelledAt: PAST_ISO,
    });
    mockStripeSubList(student.id);

    const res = await call(resumePOST, {
      method: "POST",
      cookies,
      params: { studentId: student.id },
    });
    expect(res.status).toBe(200);
    const body = await res.json<{ success: boolean }>();
    expect(body).toEqual({ success: true });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Q4: WHAT DOES IT PERSIST?
// ═════════════════════════════════════════════════════════════════════════════

describe("POST /api/students/[studentId]/subscription/resume — side effects", () => {
  it("clears cancelled_at to null and keeps status='active'", async () => {
    const { cookies, student, subscription } = await seedOwnerWithActiveSubscription({
      cancelledAt: PAST_ISO,
    });
    mockStripeSubList(student.id);

    await call(resumePOST, {
      method: "POST",
      cookies,
      params: { studentId: student.id },
    });

    const row = await expectRowExists("student_subscriptions", { id: subscription.id });
    expect(row.cancelled_at).toBeNull();
    expect(row.status).toBe("active");
  });

  it("returns 404 and does NOT write when the subscription is active but no cancellation is scheduled", async () => {
    // cancelled_at is null in the default seed.
    const { cookies, student, subscription } = await seedOwnerWithActiveSubscription();

    const res = await call(resumePOST, {
      method: "POST",
      cookies,
      params: { studentId: student.id },
    });
    expect(res.status).toBe(404);

    // Row unchanged.
    const row = await expectRowExists("student_subscriptions", { id: subscription.id });
    expect(row.status).toBe("active");
    expect(row.cancelled_at).toBeNull();
    expect(stripe.subscriptions.update).not.toHaveBeenCalled();
  });

  it("returns 404 and does NOT write when the student has no subscription at all", async () => {
    const { cookies, student } = await seedOwnerWithActiveSubscription();
    // Drop the subscription row to simulate "no sub at all" for this student.
    const { createClient } = await import("@supabase/supabase-js");
    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    await db.from("student_subscriptions").delete().eq("student_id", student.id);

    const res = await call(resumePOST, {
      method: "POST",
      cookies,
      params: { studentId: student.id },
    });
    expect(res.status).toBe(404);

    // No row created either.
    const orphan = await getRow("student_subscriptions", { student_id: student.id });
    expect(orphan).toBeNull();
    expect(stripe.subscriptions.update).not.toHaveBeenCalled();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Q5: WHAT EXTERNAL CALLS DID IT MAKE?
// ═════════════════════════════════════════════════════════════════════════════

describe("POST /api/students/[studentId]/subscription/resume — external calls", () => {
  it("calls stripe.subscriptions.update with cancel_at_period_end=false on success", async () => {
    const { cookies, student } = await seedOwnerWithActiveSubscription({
      cancelledAt: PAST_ISO,
    });
    mockStripeSubList(student.id);

    await call(resumePOST, {
      method: "POST",
      cookies,
      params: { studentId: student.id },
    });

    expect(stripe.subscriptions.update).toHaveBeenCalledTimes(1);
    expect(stripe.subscriptions.update).toHaveBeenCalledWith(
      FAKE_STRIPE_SUB_ID,
      expect.objectContaining({ cancel_at_period_end: false }),
    );
  });

  it("does NOT call stripe.subscriptions.cancel or refunds.create on resume", async () => {
    const { cookies, student } = await seedOwnerWithActiveSubscription({
      cancelledAt: PAST_ISO,
    });
    mockStripeSubList(student.id);

    await call(resumePOST, {
      method: "POST",
      cookies,
      params: { studentId: student.id },
    });

    expect(stripe.subscriptions.cancel).not.toHaveBeenCalled();
    expect(stripe.refunds.create).not.toHaveBeenCalled();
  });
});
