/**
 * Contract tests for GET /api/students/[studentId]/parent.
 *
 * Resolves the parents.id for a student the calling coach is linked to.
 * Coach UI uses this to open a conversation with the family contact.
 * Mirrors the response shape of GET /api/students/[studentId];
 * the two routes share src/lib/profiles/server/getParentForStudent.
 *
 * Five questions:
 *   Q1 ownership — assertCoachAssignedToStudent (403 if not linked)
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
  createCoach,
  createParent,
  createStudent,
  linkCoachToStudent,
} from "@tests/helpers/factories";
import { signSessionFor } from "@tests/helpers/auth";
import { resetAll } from "@tests/helpers/db";
import { call } from "@tests/helpers/request";
import { server } from "@tests/helpers/msw";

import { GET } from "@/src/app/api/students/[studentId]/parent/route";

beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterAll(() => server.close());
beforeEach(resetAll);

async function seedCoachLinkedToStudentWithParent() {
  const { account: coachAccount, coach } = await createCoach();
  const family = await createAccount({ role: 1 });
  const parent = await createParent(family);
  const student = await createStudent(family);
  await linkCoachToStudent(coach, student);
  const cookies = await signSessionFor(coachAccount);
  return { coachAccount, coach, cookies, family, parent, student };
}

// Q1
describe("GET /api/students/[studentId]/parent — ownership", () => {
  it("returns 403 when the coach is not linked to the student", async () => {
    const { cookies } = await seedCoachLinkedToStudentWithParent();
    const otherFamily = await createAccount({ role: 1 });
    await createParent(otherFamily);
    const otherStudent = await createStudent(otherFamily);

    const res = await call(GET, {
      cookies,
      params: { studentId: otherStudent.id },
    });
    expect(res.status).toBe(403);
  });
});

// Q2
describe("GET /api/students/[studentId]/parent — input validation", () => {
  it("returns 400 when studentId is not a UUID", async () => {
    const { cookies } = await seedCoachLinkedToStudentWithParent();
    const res = await call(GET, {
      cookies,
      params: { studentId: "not-a-uuid" },
    });
    expect(res.status).toBe(400);
  });
});

// Q3
describe("GET /api/students/[studentId]/parent — response shape", () => {
  it("returns { parent: { id } } for a linked student", async () => {
    const { cookies, student, parent } = await seedCoachLinkedToStudentWithParent();
    const res = await call(GET, {
      cookies,
      params: { studentId: student.id },
    });
    expect(res.status).toBe(200);
    const body = await res.json<{ parent: { id: string } }>();
    expect(body.parent.id).toBe(parent.id);
  });

  it("returns 404 when the student has no parent row", async () => {
    const { account: coachAccount, coach } = await createCoach();
    const family = await createAccount({ role: 1 });
    // No createParent(family) on purpose.
    const student = await createStudent(family);
    await linkCoachToStudent(coach, student);
    const cookies = await signSessionFor(coachAccount);

    const res = await call(GET, {
      cookies,
      params: { studentId: student.id },
    });
    expect(res.status).toBe(404);
  });
});
