/**
 * Contract tests for GET /api/coaches/[id]/sessions.
 *
 * All sessions for one coach, with the student name embedded — feeds the
 * admin coach-detail calendar.
 *
 * Five questions:
 *   Q1 ownership — none beyond the role gate (admin role is the
 *      authorization); a valid-but-unknown coach id returns 200 with an
 *      empty collection (no existence probe)
 *   Q2 validation — id path param is a UUID
 *   Q3 response — { sessions: [...] } named collection scoped to the coach,
 *      students(first_name, last_name) embedded
 *   Q4 side effects — none (read)
 *   Q5 external calls — none
 *
 * Role-gate cases live in _auth-matrix.test.ts.
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
  createAdmin,
  createCoach,
  createSession,
  createStudent,
} from "@tests/helpers/factories";
import { signSessionFor } from "@tests/helpers/auth";
import { resetAll } from "@tests/helpers/db";
import { call } from "@tests/helpers/request";
import { server } from "@tests/helpers/msw";

import { GET } from "@/src/app/api/coaches/[id]/sessions/route";

beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterAll(() => server.close());
beforeEach(resetAll);

async function seedAdminWithCoachSessions() {
  const admin = await createAdmin();
  const cookies = await signSessionFor(admin);
  const { coach } = await createCoach();
  const family = await createAccount({ role: 1 });
  const student = await createStudent(family);
  return { admin, cookies, coach, student };
}

// Q1 — no ownership gate beyond the role: unknown coach is not probed.
describe("GET /api/coaches/[id]/sessions — ownership", () => {
  it("returns 200 with an empty collection for a valid-but-unknown coach id", async () => {
    const { cookies } = await seedAdminWithCoachSessions();
    const res = await call(GET, {
      cookies,
      params: { id: "00000000-0000-4000-8000-000000000099" },
    });
    expect(res.status).toBe(200);
    const body = await res.json<{ sessions: unknown[] }>();
    expect(body.sessions).toEqual([]);
  });
});

// Q2
describe("GET /api/coaches/[id]/sessions — input validation", () => {
  it("returns 400 when id is not a UUID", async () => {
    const { cookies } = await seedAdminWithCoachSessions();
    const res = await call(GET, {
      cookies,
      params: { id: "not-a-uuid" },
    });
    expect(res.status).toBe(400);
  });

  it("error responses use the { error: string } shape", async () => {
    const { cookies } = await seedAdminWithCoachSessions();
    const res = await call(GET, {
      cookies,
      params: { id: "not-a-uuid" },
    });
    const body = await res.json<{ error?: string; message?: string; status?: number }>();
    expect(typeof body.error).toBe("string");
    expect(body.message).toBeUndefined();
    expect(body.status).toBeUndefined();
  });
});

// Q3
describe("GET /api/coaches/[id]/sessions — response shape", () => {
  it("returns { sessions: [...] } named collection (not bare array)", async () => {
    const { cookies, coach } = await seedAdminWithCoachSessions();
    const res = await call(GET, {
      cookies,
      params: { id: coach.id },
    });
    expect(res.status).toBe(200);
    const body = await res.json<{ sessions: unknown[] }>();
    expect(Array.isArray(body.sessions)).toBe(true);
  });

  it("returns only the coach's sessions, with the student name embedded", async () => {
    const { cookies, coach, student } = await seedAdminWithCoachSessions();
    const first = await createSession(coach, student, {
      start_time: "2026-07-13T15:00:00.000Z",
      end_time: "2026-07-13T16:00:00.000Z",
    });
    const second = await createSession(coach, student, {
      start_time: "2026-07-20T15:00:00.000Z",
      end_time: "2026-07-20T16:00:00.000Z",
    });
    // A different coach's session must not appear.
    const { coach: otherCoach } = await createCoach();
    await createSession(otherCoach, student);

    const res = await call(GET, {
      cookies,
      params: { id: coach.id },
    });
    expect(res.status).toBe(200);
    const body = await res.json<{
      sessions: Array<{
        id: string;
        start_time: string | null;
        end_time: string | null;
        student_id: string | null;
        students: { first_name: string | null; last_name: string | null } | null;
      }>;
    }>();
    expect(body.sessions.map((s) => s.id).sort()).toEqual(
      [first.id, second.id].sort(),
    );
    expect(body.sessions[0].students?.first_name).toBe(student.first_name);
    expect(body.sessions[0].students?.last_name).toBe(student.last_name);
  });
});

// Q4 — read only, no side effects.
// Q5 — no external calls.
