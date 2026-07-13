/**
 * Contract tests for GET /api/sessions (coach leg; the route is
 * role-dispatched, roles [1,2]).
 *
 * Returns sessions assigned to the calling coach. Optional `?student_id=`
 * filter — per docs/api-ownership.md scope discussion, when the student
 * doesn't belong to the coach we return an empty list (no information leak),
 * NOT a 403 (which would reveal the student's existence).
 *
 * Five questions:
 *   Q1 ownership — implicit via coach_id filter; no per-resource 403
 *   Q2 validation — student_id optional + UUID + .strict()
 *   Q3 response — { sessions: [...] } named collection
 *   Q4 side effects — none (read)
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

import { GET as sessionsGET } from "@/src/app/api/sessions/route";

beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterAll(() => server.close());
beforeEach(resetAll);

async function seedTwoCoachesWithStudents() {
  // Coach A linked to student A; coach B linked to student B. Each has one session.
  const { account: aAccount, coach: aCoach } = await createCoach();
  const aFamily = await createAccount({ role: 1 });
  const aStudent = await createStudent(aFamily);
  await linkCoachToStudent(aCoach, aStudent);
  await createSession(aCoach, aStudent);
  const aCookies = await signSessionFor(aAccount);

  const { account: bAccount, coach: bCoach } = await createCoach();
  const bFamily = await createAccount({ role: 1 });
  const bStudent = await createStudent(bFamily);
  await linkCoachToStudent(bCoach, bStudent);
  await createSession(bCoach, bStudent);
  const bCookies = await signSessionFor(bAccount);

  return { aAccount, aCoach, aStudent, aCookies, bAccount, bCoach, bStudent, bCookies };
}

// Q1
describe("GET /api/sessions — scoping (implicit ownership)", () => {
  it("returns only the calling coach's sessions (no cross-coach leak)", async () => {
    const { aCookies } = await seedTwoCoachesWithStudents();
    const res = await call(sessionsGET, { cookies: aCookies });
    expect(res.status).toBe(200);
    const body = await res.json<{ sessions: Array<{ student_id: string }> }>();
    expect(body.sessions.length).toBe(1);
  });

  it("returns an empty list when ?student_id= belongs to a different coach (silent scope, NOT 403)", async () => {
    const { aCookies, bStudent } = await seedTwoCoachesWithStudents();
    const res = await call(sessionsGET, {
      cookies: aCookies,
      query: { student_id: bStudent.id },
    });
    expect(res.status).toBe(200);
    const body = await res.json<{ sessions: unknown[] }>();
    expect(body.sessions).toHaveLength(0);
  });
});

// Q2
describe("GET /api/sessions — input validation", () => {
  it("returns 400 when student_id is malformed (not a UUID)", async () => {
    const { aCookies } = await seedTwoCoachesWithStudents();
    const res = await call(sessionsGET, {
      cookies: aCookies,
      query: { student_id: "not-a-uuid" },
    });
    expect(res.status).toBe(400);
  });

  it("error responses use the { error: string } shape", async () => {
    const { aCookies } = await seedTwoCoachesWithStudents();
    const res = await call(sessionsGET, {
      cookies: aCookies,
      query: { student_id: "not-a-uuid" },
    });
    const body = await res.json<{ error?: string; message?: string; status?: number }>();
    expect(typeof body.error).toBe("string");
    expect(body.message).toBeUndefined();
    expect(body.status).toBeUndefined();
  });
});

// Q3
describe("GET /api/sessions — response shape", () => {
  it("returns { sessions: [...] } named collection", async () => {
    const { aCookies } = await seedTwoCoachesWithStudents();
    const res = await call(sessionsGET, { cookies: aCookies });
    const body = await res.json<{ sessions: unknown[] }>();
    expect(Array.isArray(body.sessions)).toBe(true);
  });

  it("each session includes id, start_time, end_time, student_id, students relation", async () => {
    const { aCookies, aStudent } = await seedTwoCoachesWithStudents();
    const res = await call(sessionsGET, { cookies: aCookies });
    const body = await res.json<{
      sessions: Array<{
        id: number | string;
        start_time: string;
        end_time: string;
        student_id: string;
        students: unknown;
      }>;
    }>();
    const s = body.sessions[0];
    expect(s.student_id).toBe(aStudent.id);
    expect(typeof s.start_time).toBe("string");
    expect(typeof s.end_time).toBe("string");
    expect(s.students).toBeTruthy();
  });
});

// Q4 — read-only.
// Q5 — no external calls.
