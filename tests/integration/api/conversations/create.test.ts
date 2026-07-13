/**
 * Contract tests for POST /api/conversations.
 *
 * Upserts a conversation between the calling coach and the contact (student
 * or parent) and returns the conversation id. The body's contactId is the
 * student id today; the route also handles parent profiles.
 *
 * Five questions:
 *   Q1 ownership — assertCoachAssignedToStudent(contactId)
 *   Q2 validation — contactId required, must be UUID, .strict()
 *   Q3 response — { conversationId: string }
 *   Q4 side effects — conversations row created/upserted with (coach_id, profile_id, profile_type)
 *   Q5 external calls — none; DB-only
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
  createParent,
  createStudent,
  linkCoachToStudent,
} from "@tests/helpers/factories";
import { signSessionFor } from "@tests/helpers/auth";
import { resetAll } from "@tests/helpers/db";
import { call } from "@tests/helpers/request";
import { server } from "@tests/helpers/msw";
import { expectRowExists, expectNoRow } from "@tests/helpers/sideEffects";

import { POST as conversationPOST } from "@/src/app/api/conversations/route";

beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterAll(() => server.close());
beforeEach(resetAll);

async function seedCoachAndStudent() {
  const { account: coachAccount, coach } = await createCoach();
  const familyAccount = await createAccount({ role: 1 });
  const student = await createStudent(familyAccount);
  await linkCoachToStudent(coach, student);
  const cookies = await signSessionFor(coachAccount);
  return { coachAccount, coach, familyAccount, student, cookies };
}

async function seedCoachStudentAndParent() {
  const seeded = await seedCoachAndStudent();
  const parent = await createParent(seeded.familyAccount);
  return { ...seeded, parent };
}

// Q1
describe("POST /api/conversations — ownership", () => {
  it("returns 403 when coach is not assigned to the contact (student)", async () => {
    const { student } = await seedCoachAndStudent();
    const { account: otherAccount } = await createCoach();
    const otherCookies = await signSessionFor(otherAccount);

    const res = await call(conversationPOST, {
      method: "POST",
      cookies: otherCookies,
      body: { contactId: student.id },
    });
    expect(res.status).toBe(403);
  });

  it("does NOT create a conversations row when ownership fails", async () => {
    const { student } = await seedCoachAndStudent();
    const { account: otherAccount } = await createCoach();
    const otherCookies = await signSessionFor(otherAccount);

    await call(conversationPOST, {
      method: "POST",
      cookies: otherCookies,
      body: { contactId: student.id },
    });

    await expectNoRow("conversations", { profile_id: student.id });
  });

  it("returns 200 when assigned coach opens conversation with their student", async () => {
    const { cookies, student } = await seedCoachAndStudent();
    const res = await call(conversationPOST, {
      method: "POST",
      cookies,
      body: { contactId: student.id },
    });
    expect(res.status).toBe(200);
  });

  it("returns 200 when assigned coach opens conversation with the student's parent", async () => {
    const { cookies, parent } = await seedCoachStudentAndParent();
    const res = await call(conversationPOST, {
      method: "POST",
      cookies,
      body: { contactId: parent.id },
    });
    expect(res.status).toBe(200);
  });

  it("returns 404 when contactId is a valid UUID but not a student/parent contact", async () => {
    const { cookies } = await seedCoachAndStudent();
    const res = await call(conversationPOST, {
      method: "POST",
      cookies,
      body: { contactId: "11111111-1111-4111-8111-111111111111" },
    });
    expect(res.status).toBe(404);
  });
});

// Q2
describe("POST /api/conversations — input validation", () => {
  it("returns 400 when contactId is missing", async () => {
    const { cookies } = await seedCoachAndStudent();
    const res = await call(conversationPOST, { method: "POST", cookies });
    expect(res.status).toBe(400);
  });

  it("returns 400 when contactId is malformed (not a UUID)", async () => {
    const { cookies } = await seedCoachAndStudent();
    const res = await call(conversationPOST, {
      method: "POST",
      cookies,
      body: { contactId: "not-a-uuid" },
    });
    expect(res.status).toBe(400);
  });

  it("error responses use the { error: string } shape", async () => {
    const { cookies } = await seedCoachAndStudent();
    const res = await call(conversationPOST, { method: "POST", cookies });
    const body = await res.json<{ error?: string; message?: string; status?: number }>();
    expect(typeof body.error).toBe("string");
    expect(body.message).toBeUndefined();
    expect(body.status).toBeUndefined();
  });
});

// Q3
describe("POST /api/conversations — response shape", () => {
  it("returns { conversationId: <uuid> }", async () => {
    const { cookies, student } = await seedCoachAndStudent();
    const res = await call(conversationPOST, {
      method: "POST",
      cookies,
      body: { contactId: student.id },
    });
    expect(res.status).toBe(200);
    const body = await res.json<{ conversationId: string }>();
    expect(typeof body.conversationId).toBe("string");
    expect(body.conversationId.length).toBeGreaterThan(0);
  });
});

// Q4
describe("POST /api/conversations — side effects", () => {
  it("creates a conversations row keyed by (coach_id, profile_id, profile_type='student')", async () => {
    const { cookies, coach, student } = await seedCoachAndStudent();

    await call(conversationPOST, {
      method: "POST",
      cookies,
      body: { contactId: student.id },
    });

    const row = await expectRowExists("conversations", {
      coach_id: coach.id,
      profile_id: student.id,
    });
    expect(row.profile_type).toBe("student");
  });

  it("is idempotent — repeated calls return the same conversationId (upsert)", async () => {
    const { cookies, student } = await seedCoachAndStudent();
    const first = await call(conversationPOST, {
      method: "POST",
      cookies,
      body: { contactId: student.id },
    });
    const second = await call(conversationPOST, {
      method: "POST",
      cookies,
      body: { contactId: student.id },
    });
    const a = await first.json<{ conversationId: string }>();
    const b = await second.json<{ conversationId: string }>();
    expect(b.conversationId).toBe(a.conversationId);
  });

  it("creates a parent conversation with profile_type='parent'", async () => {
    const { cookies, coach, parent } = await seedCoachStudentAndParent();

    await call(conversationPOST, {
      method: "POST",
      cookies,
      body: { contactId: parent.id },
    });

    const row = await expectRowExists("conversations", {
      coach_id: coach.id,
      profile_id: parent.id,
    });
    expect(row.profile_type).toBe("parent");
  });
});

// Q5 — DB-only, no external calls.
