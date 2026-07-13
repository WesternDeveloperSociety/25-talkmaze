/**
 * Contract tests for GET /api/students/[studentId].
 *
 * Resolves the parent record for a given student. Used by family-side UI
 * to identify the parent of a student profile.
 *
 * Five questions:
 *   Q1 ownership — assertOwnsStudent (403 for foreign student)
 *   Q2 validation — studentId path param is a UUID
 *   Q3 response — { parent: { id: string } } entity
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
  createParent,
  createStudent,
} from "@tests/helpers/factories";
import { signSessionFor } from "@tests/helpers/auth";
import { resetAll } from "@tests/helpers/db";
import { call } from "@tests/helpers/request";
import { server } from "@tests/helpers/msw";

import { GET } from "@/src/app/api/students/[studentId]/route";

beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterAll(() => server.close());
beforeEach(resetAll);

async function seedOwnerWithStudent() {
  const owner = await createAccount({ role: 1 });
  const parent = await createParent(owner);
  const student = await createStudent(owner);
  const cookies = await signSessionFor(owner);
  return { owner, parent, student, cookies };
}

// Q1
describe("GET /api/students/[studentId] — ownership", () => {
  it("returns 403 when the caller does not own the student", async () => {
    const { student } = await seedOwnerWithStudent();
    const other = await createAccount({ role: 1 });
    const otherCookies = await signSessionFor(other);

    const res = await call(GET, {
      cookies: otherCookies,
      params: { studentId: student.id },
    });
    expect(res.status).toBe(403);
  });

  it("returns 200 when the caller owns the student", async () => {
    const { cookies, student } = await seedOwnerWithStudent();
    const res = await call(GET, {
      cookies,
      params: { studentId: student.id },
    });
    expect(res.status).toBe(200);
  });

  it("returns 404 (with correct HTTP status, not status-in-body) when student does not exist", async () => {
    const { cookies } = await seedOwnerWithStudent();
    const res = await call(GET, {
      cookies,
      params: { studentId: "00000000-0000-0000-0000-000000000000" },
    });
    expect(res.status).toBe(404);
    const body = await res.json<{ status?: number; message?: string; error?: string }>();
    // Status MUST NOT be in the body.
    expect(body.status).toBeUndefined();
    expect(body.message).toBeUndefined();
  });
});

// Q2
describe("GET /api/students/[studentId] — input validation", () => {
  it("returns 400 when studentId is not a UUID", async () => {
    const { cookies } = await seedOwnerWithStudent();
    const res = await call(GET, {
      cookies,
      params: { studentId: "not-a-uuid" },
    });
    expect(res.status).toBe(400);
  });

  it("error responses use the { error: string } shape", async () => {
    const { cookies } = await seedOwnerWithStudent();
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
describe("GET /api/students/[studentId] — response shape", () => {
  it("returns { parent: { id } } where id is the parent's UUID", async () => {
    const { cookies, parent, student } = await seedOwnerWithStudent();
    const res = await call(GET, {
      cookies,
      params: { studentId: student.id },
    });
    const body = await res.json<{ parent: { id: string } }>();
    expect(body.parent.id).toBe(parent.id);
  });
});

// Q4 — read only, no side effects.
// Q5 — no external calls.
