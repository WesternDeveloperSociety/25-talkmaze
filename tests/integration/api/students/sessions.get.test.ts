/**
 * Contract tests for GET /api/students/[studentId]/sessions.
 *
 * All sessions for one student, ordered by start time, with the coach name
 * embedded — feeds the admin student-detail calendar.
 *
 * Five questions:
 *   Q1 ownership — none beyond the role gate (admin role is the
 *      authorization); a valid-but-unknown studentId returns 200 with an
 *      empty collection (no existence probe)
 *   Q2 validation — studentId path param is a UUID
 *   Q3 response — { sessions: [...] } named collection, ordered by
 *      start_time, coaches(first_name, last_name) embedded
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

import { GET } from "@/src/app/api/students/[studentId]/sessions/route";

beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterAll(() => server.close());
beforeEach(resetAll);

async function seedAdminWithStudentSessions() {
  const admin = await createAdmin();
  const cookies = await signSessionFor(admin);
  const { coach } = await createCoach();
  const family = await createAccount({ role: 1 });
  const student = await createStudent(family);
  return { admin, cookies, coach, student };
}

// Q1 — no ownership gate beyond the role: unknown student is not probed.
describe("GET /api/students/[studentId]/sessions — ownership", () => {
  it("returns 200 with an empty collection for a valid-but-unknown studentId", async () => {
    const { cookies } = await seedAdminWithStudentSessions();
    const res = await call(GET, {
      cookies,
      params: { studentId: "00000000-0000-4000-8000-000000000099" },
    });
    expect(res.status).toBe(200);
    const body = await res.json<{ sessions: unknown[] }>();
    expect(body.sessions).toEqual([]);
  });
});

// Q2
describe("GET /api/students/[studentId]/sessions — input validation", () => {
  it("returns 400 when studentId is not a UUID", async () => {
    const { cookies } = await seedAdminWithStudentSessions();
    const res = await call(GET, {
      cookies,
      params: { studentId: "not-a-uuid" },
    });
    expect(res.status).toBe(400);
  });

  it("error responses use the { error: string } shape", async () => {
    const { cookies } = await seedAdminWithStudentSessions();
    const res = await call(GET, {
      cookies,
      params: { studentId: "not-a-uuid" },
    });
    const body = await res.json<{ error?: string; message?: string; status?: number }>();
    expect(typeof body.error).toBe("string");
    expect(body.message).toBeUndefined();
    expect(body.status).toBeUndefined();
  });
});

// Q3
describe("GET /api/students/[studentId]/sessions — response shape", () => {
  it("returns { sessions: [...] } named collection (not bare array)", async () => {
    const { cookies, student } = await seedAdminWithStudentSessions();
    const res = await call(GET, {
      cookies,
      params: { studentId: student.id },
    });
    expect(res.status).toBe(200);
    const body = await res.json<{ sessions: unknown[] }>();
    expect(Array.isArray(body.sessions)).toBe(true);
  });

  it("returns only the student's sessions, ordered by start_time, with the coach name embedded", async () => {
    const { cookies, coach, student } = await seedAdminWithStudentSessions();
    const later = await createSession(coach, student, {
      start_time: "2026-07-20T15:00:00.000Z",
      end_time: "2026-07-20T16:00:00.000Z",
    });
    const earlier = await createSession(coach, student, {
      start_time: "2026-07-13T15:00:00.000Z",
      end_time: "2026-07-13T16:00:00.000Z",
    });
    // A different student's session must not appear.
    const otherFamily = await createAccount({ role: 1 });
    const otherStudent = await createStudent(otherFamily);
    await createSession(coach, otherStudent);

    const res = await call(GET, {
      cookies,
      params: { studentId: student.id },
    });
    expect(res.status).toBe(200);
    const body = await res.json<{
      sessions: Array<{
        id: string;
        start_time: string | null;
        end_time: string | null;
        coach_id: string | null;
        coaches: { first_name: string | null; last_name: string | null } | null;
      }>;
    }>();
    expect(body.sessions.map((s) => s.id)).toEqual([earlier.id, later.id]);
    expect(body.sessions[0].coaches?.first_name).toBe(coach.first_name);
    expect(body.sessions[0].coaches?.last_name).toBe(coach.last_name);
  });
});

// Q4 — read only, no side effects.
// Q5 — no external calls.
