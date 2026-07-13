/**
 * Contract tests for POST /api/students/[studentId]/subscription/schedule.
 *
 * Initiates a plan upgrade or downgrade. Returns a Stripe SetupIntent
 * `client_secret` that the client uses to confirm payment; the actual
 * subscription change happens later in the `setup_intent.succeeded` webhook.
 * This route is a READ + Stripe initiation only — no student_subscriptions
 * mutations on this call.
 *
 * Five questions (per docs/api-contract.md + test-rewrite-runbook):
 *   Q1 WHO CAN CALL IT?       — ownership only; role gate in _auth-matrix.test.ts
 *   Q2 WHAT INPUTS?           — Zod: priceId required, studentId UUID, no unknown fields
 *   Q3 WHAT DOES IT RETURN?   — { clientSecret, prefill, effectiveDate }
 *   Q4 WHAT DOES IT PERSIST?  — NOTHING. student_subscriptions must be untouched.
 *   Q5 WHAT EXTERNAL CALLS?   — customers.retrieve, subscriptions.list (find),
 *                               setupIntents.create with full metadata payload
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
    subscriptions: { list: vi.fn(), update: vi.fn(), cancel: vi.fn() },
    subscriptionSchedules: { release: vi.fn() },
    invoices: { retrieve: vi.fn(), list: vi.fn() },
    invoicePayments: { list: vi.fn() },
    refunds: { create: vi.fn() },
    customers: { retrieve: vi.fn() },
    setupIntents: { create: vi.fn() },
  },
}));

import { createClient } from "@supabase/supabase-js";
import { createPlan } from "@tests/helpers/factories";
import { resetAll } from "@tests/helpers/db";
import { call } from "@tests/helpers/request";
import { server } from "@tests/helpers/msw";
import { expectRowExists } from "@tests/helpers/sideEffects";
import {
  seedOwnerWithActiveSubscription,
  seedStranger,
} from "@tests/helpers/subscriptionFixtures";
import {
  FAKE_CUSTOMER_ID,
  FAKE_STRIPE_SUB_ID,
  mockCustomer,
  mockSetupIntent,
  mockStripeSubList,
} from "@tests/helpers/stripeMocks";

import { POST as schedulePOST } from "@/src/app/api/students/[studentId]/subscription/schedule/route";
import { stripe } from "@/src/services/stripe/client";

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterAll(() => server.close());
beforeEach(resetAll);
afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});

/** Seed an owner with an active subscription plus a *target* plan for the upgrade. */
async function seedOwnerAndTarget(opts?: { pendingPlanIdMatchesTarget?: boolean }) {
  const seeded = await seedOwnerWithActiveSubscription();
  const target = await createPlan({
    classes: 12,
    stripe_price_id: `price_target_${Date.now()}`,
  });

  if (opts?.pendingPlanIdMatchesTarget) {
    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    await db
      .from("student_subscriptions")
      .update({
        pending_plan_id: target.id,
        pending_stripe_schedule_id: "sub_sched_pre_existing",
      })
      .eq("id", seeded.subscription.id);
  }

  return { ...seeded, target };
}

// ═════════════════════════════════════════════════════════════════════════════
// Q1: WHO CAN CALL IT?
// ═════════════════════════════════════════════════════════════════════════════

describe("POST /api/students/[studentId]/subscription/schedule — ownership", () => {
  it("returns 403 when the caller does not own the target student", async () => {
    const { student, target } = await seedOwnerAndTarget();
    const { cookies: strangerCookies } = await seedStranger();

    const res = await call(schedulePOST, {
      method: "POST",
      cookies: strangerCookies,
      params: { studentId: student.id }, body: { priceId: target.stripe_price_id },
    });
    expect(res.status).toBe(403);
  });

  it("does NOT call Stripe when ownership check fails", async () => {
    const { student, target } = await seedOwnerAndTarget();
    const { cookies: strangerCookies } = await seedStranger();

    await call(schedulePOST, {
      method: "POST",
      cookies: strangerCookies,
      params: { studentId: student.id }, body: { priceId: target.stripe_price_id },
    });

    expect(stripe.customers.retrieve).not.toHaveBeenCalled();
    expect(stripe.setupIntents.create).not.toHaveBeenCalled();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Q2: WHAT INPUTS DOES IT ACCEPT?
// ═════════════════════════════════════════════════════════════════════════════

describe("POST /api/students/[studentId]/subscription/schedule — input validation", () => {
  it("returns 400 when priceId is missing", async () => {
    const { cookies, student } = await seedOwnerAndTarget();

    const res = await call(schedulePOST, {
      method: "POST",
      cookies,
      params: { studentId: student.id },
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when studentId is malformed (not a UUID)", async () => {
    const { cookies, target } = await seedOwnerAndTarget();

    const res = await call(schedulePOST, {
      method: "POST",
      cookies,
      params: { studentId: "not-a-uuid" }, body: { priceId: target.stripe_price_id },
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when body contains unknown fields (strict)", async () => {
    const { cookies, student, target } = await seedOwnerAndTarget();

    const res = await call(schedulePOST, {
      method: "POST",
      cookies,
      params: { studentId: student.id },
      body: {
        priceId: target.stripe_price_id,
        extraneous: "field",
      },
    });
    expect(res.status).toBe(400);
  });

  it("error responses use the { error: string } shape", async () => {
    const { cookies, student } = await seedOwnerAndTarget();

    const res = await call(schedulePOST, {
      method: "POST",
      cookies,
      params: { studentId: student.id },
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

describe("POST /api/students/[studentId]/subscription/schedule — response shape", () => {
  it("returns { clientSecret, prefill, effectiveDate } on success", async () => {
    const { cookies, student, target } = await seedOwnerAndTarget();
    mockCustomer();
    mockStripeSubList(student.id);
    mockSetupIntent();

    const res = await call(schedulePOST, {
      method: "POST",
      cookies,
      params: { studentId: student.id }, body: { priceId: target.stripe_price_id },
    });
    expect(res.status).toBe(200);

    const body = await res.json<{
      clientSecret: string;
      prefill: { name: string; email: string; phone: string };
      effectiveDate: string;
    }>();
    expect(typeof body.clientSecret).toBe("string");
    expect(body.clientSecret.length).toBeGreaterThan(0);
    expect(body.prefill).toEqual({
      name: "Test Parent",
      email: "test@example.com",
      phone: "",
    });
    // effectiveDate is an ISO timestamp
    expect(body.effectiveDate).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(Number.isNaN(Date.parse(body.effectiveDate))).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Q4: WHAT DOES IT PERSIST?
// This route is a READ + Stripe initiation. The actual subscription change
// happens in the `setup_intent.succeeded` webhook. Confirm the initiation call
// does NOT mutate student_subscriptions.
// ═════════════════════════════════════════════════════════════════════════════

describe("POST /api/students/[studentId]/subscription/schedule — side effects", () => {
  it("does NOT mutate student_subscriptions on success (webhook does that)", async () => {
    const { cookies, student, target, subscription } = await seedOwnerAndTarget();
    mockCustomer();
    mockStripeSubList(student.id);
    mockSetupIntent();

    await call(schedulePOST, {
      method: "POST",
      cookies,
      params: { studentId: student.id }, body: { priceId: target.stripe_price_id },
    });

    const row = await expectRowExists("student_subscriptions", { id: subscription.id });
    expect(row.pending_plan_id).toBeNull();
    expect(row.pending_stripe_schedule_id).toBeNull();
    expect(row.status).toBe("active");
  });

  it("returns 404 when the student has no active subscription", async () => {
    const { cookies, student, target } = await seedOwnerAndTarget();
    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    await db.from("student_subscriptions").delete().eq("student_id", student.id);

    const res = await call(schedulePOST, {
      method: "POST",
      cookies,
      params: { studentId: student.id }, body: { priceId: target.stripe_price_id },
    });
    expect(res.status).toBe(404);
    expect(stripe.setupIntents.create).not.toHaveBeenCalled();
  });

  it("returns 404 when the target priceId does not match any plan", async () => {
    const { cookies, student } = await seedOwnerAndTarget();

    const res = await call(schedulePOST, {
      method: "POST",
      cookies,
      params: { studentId: student.id }, body: { priceId: "price_does_not_exist_xyz" },
    });
    expect(res.status).toBe(404);
    expect(stripe.setupIntents.create).not.toHaveBeenCalled();
  });

  it("returns 409 when the student is already on the requested plan", async () => {
    const { cookies, student, plan } = await seedOwnerAndTarget();

    const res = await call(schedulePOST, {
      method: "POST",
      cookies,
      params: { studentId: student.id }, body: { priceId: plan.stripe_price_id },
    });
    expect(res.status).toBe(409);
    const body = await res.json<{ error: string }>();
    expect(body.error.toLowerCase()).toContain("already on this plan");
    expect(stripe.setupIntents.create).not.toHaveBeenCalled();
  });

  it("returns 409 when a change to the target plan is already scheduled", async () => {
    const { cookies, student, target } = await seedOwnerAndTarget({
      pendingPlanIdMatchesTarget: true,
    });

    const res = await call(schedulePOST, {
      method: "POST",
      cookies,
      params: { studentId: student.id }, body: { priceId: target.stripe_price_id },
    });
    expect(res.status).toBe(409);
    const body = await res.json<{ error: string }>();
    expect(body.error.toLowerCase()).toContain("already scheduled");
    expect(stripe.setupIntents.create).not.toHaveBeenCalled();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Q5: WHAT EXTERNAL CALLS DID IT MAKE?
// ═════════════════════════════════════════════════════════════════════════════

describe("POST /api/students/[studentId]/subscription/schedule — external calls", () => {
  it("calls stripe.customers.retrieve with the account's customer id", async () => {
    const { cookies, student, target } = await seedOwnerAndTarget();
    mockCustomer();
    mockStripeSubList(student.id);
    mockSetupIntent();

    await call(schedulePOST, {
      method: "POST",
      cookies,
      params: { studentId: student.id }, body: { priceId: target.stripe_price_id },
    });

    expect(stripe.customers.retrieve).toHaveBeenCalledWith(FAKE_CUSTOMER_ID);
  });

  it("calls stripe.setupIntents.create with the upgrade metadata payload", async () => {
    const { cookies, owner, student, target } = await seedOwnerAndTarget();
    mockCustomer();
    mockStripeSubList(student.id);
    mockSetupIntent();

    await call(schedulePOST, {
      method: "POST",
      cookies,
      params: { studentId: student.id }, body: { priceId: target.stripe_price_id },
    });

    expect(stripe.setupIntents.create).toHaveBeenCalledTimes(1);
    expect(stripe.setupIntents.create).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: FAKE_CUSTOMER_ID,
        usage: "off_session",
        metadata: expect.objectContaining({
          account_id: owner.id,
          student_id: student.id,
          target_price_id: target.stripe_price_id,
          stripe_subscription_id: FAKE_STRIPE_SUB_ID,
        }),
      }),
    );
  });

  it("passes the existing pending schedule id through metadata.replace_schedule_id when one exists", async () => {
    const { cookies, student } = await seedOwnerAndTarget();
    // Set a pending schedule on a DIFFERENT plan so the route doesn't bail with 409.
    const otherTarget = await createPlan({
      classes: 16,
      stripe_price_id: `price_other_${Date.now()}`,
    });
    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    await db
      .from("student_subscriptions")
      .update({
        pending_plan_id: otherTarget.id,
        pending_stripe_schedule_id: "sub_sched_to_replace",
      })
      .eq("student_id", student.id);

    // Now request a switch to a third plan — different from current AND different
    // from the currently-pending one, so the route reaches the setupIntent step.
    const newTarget = await createPlan({
      classes: 20,
      stripe_price_id: `price_new_${Date.now()}`,
    });

    mockCustomer();
    mockStripeSubList(student.id);
    mockSetupIntent();

    await call(schedulePOST, {
      method: "POST",
      cookies,
      params: { studentId: student.id }, body: { priceId: newTarget.stripe_price_id },
    });

    expect(stripe.setupIntents.create).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          replace_schedule_id: "sub_sched_to_replace",
        }),
      }),
    );
  });
});
