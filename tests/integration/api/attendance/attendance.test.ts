/**
 * Integration tests for /api/attendance (GET, POST, DELETE).
 *
 * GET   — any authenticated user; returns attendance records + streak count
 * POST  — coach (role=2) or admin (role=3) only; upserts a record and adjusts
 *         sessions_remaining when the "consuming" state changes
 * DELETE — coach or admin only; removes a record and restores sessions_remaining
 *          if the deleted record was "attended" or "missed"
 *
 * sessions_remaining rules:
 *   "attended" and "missed" consume a slot; "cancelled" does not.
 *   Adjustments only fire when the consuming state CHANGES (new→consuming,
 *   consuming→non-consuming). Staying within the same category is a no-op.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import {
  createAccount,
  createCoach,
  createStudent,
  createPlan,
  createSubscription,
  linkCoachToStudent,
} from "@tests/helpers/factories";
import { signSessionFor, ANON } from "@tests/helpers/auth";
import { call } from "@tests/helpers/request";
import { server } from "@tests/helpers/msw";

import {
  GET,
  POST,
  DELETE,
} from "@/src/app/api/attendance/route";

// ── Fixtures ──────────────────────────────────────────────────────────────────

let coachCookies: string;
let adminCookies: string;
let regularCookies: string;
let unassignedCoachCookies: string; // coach NOT linked to the student
let foreignFamilyCookies: string;   // regular user from a completely different family

let studentId: string;           // student with active subscription
let studentNoSubId: string;      // student with no subscription (for DELETE no-op)
let subscriptionId: string;      // used to re-read sessions_remaining

const SESSIONS_INITIAL = 8;

// Unique dates per test to avoid unique-constraint collisions
const DATE_GET     = "2024-03-01";
const DATE_POST_1  = "2024-03-02"; // attended → decrement
const DATE_POST_2  = "2024-03-03"; // cancelled → no decrement
const DATE_POST_3  = "2024-03-04"; // upsert attended→cancelled → restore
const DATE_DELETE  = "2024-03-05"; // delete attended → restore
const DATE_NORECORD = "2024-03-06"; // delete non-existent → no-op

beforeAll(async () => {
  server.listen({ onUnhandledRequest: "bypass" });

  const adminDb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { account: coachAccount, coach } = await createCoach();
  coachCookies = await signSessionFor(coachAccount);

  // A second coach with no assignment to the student
  const { account: unassignedCoachAccount } = await createCoach();
  unassignedCoachCookies = await signSessionFor(unassignedCoachAccount);

  const admin = await createAccount({ role: 3 });
  adminCookies = await signSessionFor(admin);

  // A completely separate family — should not be able to read another family's attendance
  const foreignFamily = await createAccount({ role: 1 });
  foreignFamilyCookies = await signSessionFor(foreignFamily);

  // `regular` IS the student's family — owns studentId so GET-for-owner returns
  // 200, while `foreignFamily` does NOT and returns 403 (audit-driven).
  const regular = await createAccount({ role: 1 });
  regularCookies = await signSessionFor(regular);
  const student = await createStudent(regular);
  studentId = student.id;

  // Link the primary coach to the student so POST/DELETE ownership passes.
  // `unassignedCoachCookies` stays unlinked to exercise the 403 path.
  await linkCoachToStudent(coach, student);

  const plan = await createPlan({ classes: SESSIONS_INITIAL });
  const sub = await createSubscription(student, plan, {
    status: "active",
    sessions_remaining: SESSIONS_INITIAL,
  });
  subscriptionId = sub.id;

  const family2 = await createAccount({ role: 1 });
  const studentNoSub = await createStudent(family2);
  studentNoSubId = studentNoSub.id;

  // Seed two attendance records for the GET streak test:
  //   most recent = "attended", second = "attended" → streak = 2
  await adminDb.from("session_attendance").insert([
    {
      student_id: studentId,
      session_date: DATE_GET,
      status: "attended",
      updated_at: new Date().toISOString(),
    },
    {
      student_id: studentId,
      session_date: "2024-02-29",
      status: "attended",
      updated_at: new Date().toISOString(),
    },
    {
      student_id: studentId,
      session_date: "2024-02-28",
      status: "missed",
      updated_at: new Date().toISOString(),
    },
  ]);
});

afterAll(() => server.close());

// ── Helper ────────────────────────────────────────────────────────────────────

async function getSessionsRemaining(): Promise<number> {
  const adminDb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  const { data } = await adminDb
    .from("student_subscriptions")
    .select("sessions_remaining")
    .eq("id", subscriptionId)
    .single();
  return data?.sessions_remaining ?? 0;
}

// ── GET /api/attendance ───────────────────────────────────────────────────────

describe("GET /api/attendance", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await call(GET, {
      cookies: ANON.cookies,
      query: { student_id: studentId },
    });
    expect(res.status).toBe(401);
  });

  it("returns 400 when student_id query param is missing", async () => {
    const res = await call(GET, { cookies: coachCookies });
    expect(res.status).toBe(400);
  });

  it("returns 200 with attendance records and streak for a coach", async () => {
    const res = await call(GET, {
      cookies: coachCookies,
      query: { student_id: studentId },
    });
    expect(res.status).toBe(200);
    const body = await res.json<{ attendance: unknown[]; streak: number }>();
    expect(Array.isArray(body.attendance)).toBe(true);
    expect(typeof body.streak).toBe("number");
  });

  it("returns 200 when the calling family OWNS the student", async () => {
    // `regular` is studentId's family — assertOwnsStudent passes.
    const res = await call(GET, {
      cookies: regularCookies,
      query: { student_id: studentId },
    });
    expect(res.status).toBe(200);
  });

  it("calculates streak correctly — attended records count, missed breaks it", async () => {
    // Seeded: DATE_GET=attended, 2024-02-29=attended, 2024-02-28=missed
    // Records are ordered descending by session_date, so streak is:
    //   attended → streak=1, attended → streak=2, missed → break → streak=2
    const res = await call(GET, {
      cookies: coachCookies,
      query: { student_id: studentId },
    });
    const body = await res.json<{ streak: number }>();
    expect(body.streak).toBe(2);
  });
});

// ── POST /api/attendance ──────────────────────────────────────────────────────

describe("POST /api/attendance — auth and role", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await call(POST, {
      method: "POST",
      cookies: ANON.cookies,
      body: { student_id: studentId, session_date: DATE_POST_1, status: "attended" },
    });
    expect(res.status).toBe(401);
  });

  it("returns 403 for a regular user (role=1)", async () => {
    const res = await call(POST, {
      method: "POST",
      cookies: regularCookies,
      body: { student_id: studentId, session_date: DATE_POST_1, status: "attended" },
    });
    expect(res.status).toBe(403);
  });

  it("returns 400 when required fields are missing", async () => {
    const res = await call(POST, {
      method: "POST",
      cookies: coachCookies,
      body: { student_id: studentId },
    });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/attendance — sessions_remaining logic", () => {
  it("decrements sessions_remaining when marking a new record as attended", async () => {
    const before = await getSessionsRemaining();
    const res = await call(POST, {
      method: "POST",
      cookies: coachCookies,
      body: { student_id: studentId, session_date: DATE_POST_1, status: "attended" },
    });
    expect(res.status).toBe(201);
    const after = await getSessionsRemaining();
    expect(after).toBe(before - 1);
  });

  it("does not change sessions_remaining when marking a new record as cancelled", async () => {
    const before = await getSessionsRemaining();
    const res = await call(POST, {
      method: "POST",
      cookies: coachCookies,
      body: { student_id: studentId, session_date: DATE_POST_2, status: "cancelled" },
    });
    expect(res.status).toBe(201);
    const after = await getSessionsRemaining();
    expect(after).toBe(before);
  });

  it("restores sessions_remaining when upsert changes attended → cancelled", async () => {
    // First POST: attended → decrements
    await call(POST, {
      method: "POST",
      cookies: coachCookies,
      body: { student_id: studentId, session_date: DATE_POST_3, status: "attended" },
    });
    const afterAttended = await getSessionsRemaining();

    // Second POST (upsert): attended → cancelled → restores
    const res = await call(POST, {
      method: "POST",
      cookies: coachCookies,
      body: { student_id: studentId, session_date: DATE_POST_3, status: "cancelled" },
    });
    expect(res.status).toBe(201);
    const afterCancelled = await getSessionsRemaining();
    expect(afterCancelled).toBe(afterAttended + 1);
  });

  it("admin can also post attendance", async () => {
    const res = await call(POST, {
      method: "POST",
      cookies: adminCookies,
      body: {
        student_id: studentId,
        session_date: "2024-03-07",
        status: "missed",
      },
    });
    expect(res.status).toBe(201);
  });
});

// ── DELETE /api/attendance ────────────────────────────────────────────────────

describe("DELETE /api/attendance — auth and role", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await call(DELETE, {
      method: "DELETE",
      cookies: ANON.cookies,
      body: { student_id: studentId, session_date: DATE_DELETE },
    });
    expect(res.status).toBe(401);
  });

  it("returns 403 for a regular user (role=1)", async () => {
    const res = await call(DELETE, {
      method: "DELETE",
      cookies: regularCookies,
      body: { student_id: studentId, session_date: DATE_DELETE },
    });
    expect(res.status).toBe(403);
  });

  it("returns 400 when required fields are missing", async () => {
    const res = await call(DELETE, {
      method: "DELETE",
      cookies: coachCookies,
      body: { student_id: studentId },
    });
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/attendance — behaviour", () => {
  it("returns 200 and is a no-op when no record exists for that date", async () => {
    const before = await getSessionsRemaining();
    const res = await call(DELETE, {
      method: "DELETE",
      cookies: coachCookies,
      body: { student_id: studentId, session_date: DATE_NORECORD },
    });
    expect(res.status).toBe(200);
    const after = await getSessionsRemaining();
    expect(after).toBe(before); // nothing to restore
  });

  it("deletes an attended record and restores sessions_remaining", async () => {
    // Seed a record to delete
    await call(POST, {
      method: "POST",
      cookies: coachCookies,
      body: { student_id: studentId, session_date: DATE_DELETE, status: "attended" },
    });
    const afterPost = await getSessionsRemaining();

    const res = await call(DELETE, {
      method: "DELETE",
      cookies: coachCookies,
      body: { student_id: studentId, session_date: DATE_DELETE },
    });
    expect(res.status).toBe(200);
    const afterDelete = await getSessionsRemaining();
    expect(afterDelete).toBe(afterPost + 1);
  });

  it("deletes a cancelled record without changing sessions_remaining", async () => {
    // Seed a cancelled record (DATE_POST_2 was set to cancelled earlier)
    const before = await getSessionsRemaining();
    const res = await call(DELETE, {
      method: "DELETE",
      cookies: coachCookies,
      body: { student_id: studentId, session_date: DATE_POST_2 },
    });
    expect(res.status).toBe(200);
    const after = await getSessionsRemaining();
    expect(after).toBe(before); // cancelled records don't affect sessions_remaining
  });
});

// ── Ownership gaps (AUDIT — all currently failing) ────────────────────────────

describe("GET /api/attendance — ownership (AUDIT: no ownership check)", () => {
  it("returns 403 for a family user reading a different family's attendance (AUDIT: currently 200)", async () => {
    // foreignFamilyCookies belongs to a completely unrelated account
    const res = await call(GET, {
      cookies: foreignFamilyCookies,
      query: { student_id: studentId },
    });
    expect(res.status).toBe(403);
  });
});

describe("POST /api/attendance — coach ownership (AUDIT: no assignment check)", () => {
  it("returns 403 when a coach posts attendance for a student they are not assigned to (AUDIT: currently 201)", async () => {
    const res = await call(POST, {
      method: "POST",
      cookies: unassignedCoachCookies,
      body: { student_id: studentId, session_date: "2024-03-10", status: "attended" },
    });
    expect(res.status).toBe(403);
  });
});

describe("DELETE /api/attendance — coach ownership (AUDIT: no assignment check)", () => {
  it("returns 403 when a coach deletes attendance for a student they are not assigned to (AUDIT: currently 200)", async () => {
    const res = await call(DELETE, {
      method: "DELETE",
      cookies: unassignedCoachCookies,
      body: { student_id: studentId, session_date: DATE_GET },
    });
    expect(res.status).toBe(403);
  });
});
