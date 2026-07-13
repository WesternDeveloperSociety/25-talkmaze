/**
 * Contract tests for PATCH /api/sessions/[id].
 *
 * Updates a session's start_time and end_time.
 *
 * Five questions:
 *   Q1 ownership — assertCoachOwnsSession; 404 for both "doesn't exist" AND
 *                  "exists but not yours" (sessions.id is sequential bigint —
 *                  enumeration prevention per api-ownership.md:170-178)
 *   Q2 validation — id is numeric; start_time + end_time are ISO strings; .strict()
 *   Q3 response — { success: true }
 *   Q4 side effects — sessions.start_time and end_time updated
 *   Q5 external calls — none
 */
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from "vitest";
import {
  createAccount,
  createCoach,
  createStudent,
  createSession,
  linkCoachToStudent,
} from "@tests/helpers/factories";
import { signSessionFor } from "@tests/helpers/auth";
import { resetAll } from "@tests/helpers/db";
import { call } from "@tests/helpers/request";
import { server } from "@tests/helpers/msw";
import { expectRowExists } from "@tests/helpers/sideEffects";

import { PATCH as sessionPATCH } from "@/src/app/api/sessions/[id]/route";

beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterAll(() => server.close());
beforeEach(resetAll);

async function seedSession() {
  const { account: coachAccount, coach } = await createCoach();
  const familyAccount = await createAccount({ role: 1 });
  const student = await createStudent(familyAccount);
  await linkCoachToStudent(coach, student);
  const session = await createSession(coach, student);
  const cookies = await signSessionFor(coachAccount);
  return { coachAccount, coach, student, session, cookies };
}

const NEW_START = "2026-06-01T15:00:00.000Z";
const NEW_END = "2026-06-01T16:00:00.000Z";

// Q1
describe("PATCH /api/sessions/[id] — ownership", () => {
  it("returns 404 when session belongs to a different coach (enumeration prevention)", async () => {
    const { session } = await seedSession();
    const { account: otherAccount } = await createCoach();
    const otherCookies = await signSessionFor(otherAccount);

    const res = await call(sessionPATCH, {
      method: "PATCH",
      cookies: otherCookies,
      params: { id: String(session.id) },
      body: { start_time: NEW_START, end_time: NEW_END },
    });
    expect(res.status).toBe(404);
  });

  it("returns 404 when session id does not exist (same status as 'not yours')", async () => {
    const { cookies } = await seedSession();
    const res = await call(sessionPATCH, {
      method: "PATCH",
      cookies,
      params: { id: "999999999" },
      body: { start_time: NEW_START, end_time: NEW_END },
    });
    expect(res.status).toBe(404);
  });

  it("returns 200 when coach owns the session", async () => {
    const { cookies, session } = await seedSession();
    const res = await call(sessionPATCH, {
      method: "PATCH",
      cookies,
      params: { id: String(session.id) },
      body: { start_time: NEW_START, end_time: NEW_END },
    });
    expect(res.status).toBe(200);
  });
});

// Q2
describe("PATCH /api/sessions/[id] — input validation", () => {
  it("returns 400 when id is not numeric", async () => {
    const { cookies } = await seedSession();
    const res = await call(sessionPATCH, {
      method: "PATCH",
      cookies,
      params: { id: "not-a-number" },
      body: { start_time: NEW_START, end_time: NEW_END },
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when start_time is missing", async () => {
    const { cookies, session } = await seedSession();
    const res = await call(sessionPATCH, {
      method: "PATCH",
      cookies,
      params: { id: String(session.id) },
      body: { end_time: NEW_END },
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when end_time is missing", async () => {
    const { cookies, session } = await seedSession();
    const res = await call(sessionPATCH, {
      method: "PATCH",
      cookies,
      params: { id: String(session.id) },
      body: { start_time: NEW_START },
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when body contains unknown fields (strict)", async () => {
    const { cookies, session } = await seedSession();
    const res = await call(sessionPATCH, {
      method: "PATCH",
      cookies,
      params: { id: String(session.id) },
      body: { start_time: NEW_START, end_time: NEW_END, extraneous: "field" },
    });
    expect(res.status).toBe(400);
  });

  it("error responses use the { error: string } shape", async () => {
    const { cookies, session } = await seedSession();
    const res = await call(sessionPATCH, {
      method: "PATCH",
      cookies,
      params: { id: String(session.id) },
      body: { end_time: NEW_END },
    });
    const body = await res.json<{ error?: string; message?: string; status?: number }>();
    expect(typeof body.error).toBe("string");
    expect(body.message).toBeUndefined();
    expect(body.status).toBeUndefined();
  });
});

// Q3
describe("PATCH /api/sessions/[id] — response shape", () => {
  it("returns { success: true } on update", async () => {
    const { cookies, session } = await seedSession();
    const res = await call(sessionPATCH, {
      method: "PATCH",
      cookies,
      params: { id: String(session.id) },
      body: { start_time: NEW_START, end_time: NEW_END },
    });
    const body = await res.json<{ success: boolean }>();
    expect(body).toEqual({ success: true });
  });
});

// Q4
describe("PATCH /api/sessions/[id] — side effects", () => {
  it("updates sessions.start_time and end_time on success", async () => {
    const { cookies, session } = await seedSession();
    await call(sessionPATCH, {
      method: "PATCH",
      cookies,
      params: { id: String(session.id) },
      body: { start_time: NEW_START, end_time: NEW_END },
    });

    const row = await expectRowExists("sessions", { id: session.id });
    expect(new Date(row.start_time).toISOString()).toBe(NEW_START);
    expect(new Date(row.end_time).toISOString()).toBe(NEW_END);
  });

  it("does NOT write sessions when ownership check fails", async () => {
    const { session } = await seedSession();
    const { account: otherAccount } = await createCoach();
    const otherCookies = await signSessionFor(otherAccount);

    const before = await expectRowExists("sessions", { id: session.id });

    await call(sessionPATCH, {
      method: "PATCH",
      cookies: otherCookies,
      params: { id: String(session.id) },
      body: { start_time: NEW_START, end_time: NEW_END },
    });

    const after = await expectRowExists("sessions", { id: session.id });
    expect(after.start_time).toBe(before.start_time);
    expect(after.end_time).toBe(before.end_time);
  });
});

// Q5 — no external calls.
