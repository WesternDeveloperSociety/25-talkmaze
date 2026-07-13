/**
 * Contract tests for /api/students/[studentId]/availability (GET, PUT).
 *
 * Family-facing read/write of a student's weekly recurring availability.
 *
 * Five questions:
 *   Q1 ownership — assertOwnsStudent (403 for foreign student)
 *   Q2 validation — studentId UUID; PUT body with availability map + timezone
 *   Q3 response — GET: { availability: [...] }; PUT: { success: true }
 *   Q4 side effects — PUT delete+insert student_availabilities rows
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
  createStudent,
} from "@tests/helpers/factories";
import { signSessionFor } from "@tests/helpers/auth";
import { resetAll } from "@tests/helpers/db";
import { call } from "@tests/helpers/request";
import { server } from "@tests/helpers/msw";
import { expectRowExists, getRow } from "@tests/helpers/sideEffects";

import {
  GET,
  PUT,
} from "@/src/app/api/students/[studentId]/availability/route";

beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterAll(() => server.close());
beforeEach(resetAll);

async function seedOwnerWithStudent() {
  const owner = await createAccount({ role: 1 });
  const student = await createStudent(owner);
  const cookies = await signSessionFor(owner);
  return { owner, student, cookies };
}

const VALID_PUT_BODY = {
  availability: { Monday: [{ start: "09:00", end: "10:00" }] },
  timezone: "America/New_York",
};

// ═════════════════════════════════════════════════════════════════════════════
// GET
// ═════════════════════════════════════════════════════════════════════════════

describe("GET /api/students/[studentId]/availability — ownership", () => {
  it("returns 403 when caller does not own the student", async () => {
    const { student } = await seedOwnerWithStudent();
    const other = await createAccount({ role: 1 });
    const otherCookies = await signSessionFor(other);

    const res = await call(GET, {
      cookies: otherCookies,
      params: { studentId: student.id },
    });
    expect(res.status).toBe(403);
  });

  it("returns 200 when caller owns the student", async () => {
    const { cookies, student } = await seedOwnerWithStudent();
    const res = await call(GET, {
      cookies,
      params: { studentId: student.id },
    });
    expect(res.status).toBe(200);
  });
});

describe("GET /api/students/[studentId]/availability — input validation", () => {
  it("returns 400 when studentId is not a UUID", async () => {
    const { cookies } = await seedOwnerWithStudent();
    const res = await call(GET, {
      cookies,
      params: { studentId: "not-a-uuid" },
    });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/students/[studentId]/availability — response shape", () => {
  it("returns { availability: [...] } named collection (not bare array)", async () => {
    const { cookies, student } = await seedOwnerWithStudent();
    const res = await call(GET, {
      cookies,
      params: { studentId: student.id },
    });
    const body = await res.json<{ availability: unknown[] }>();
    expect(Array.isArray(body.availability)).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// PUT
// ═════════════════════════════════════════════════════════════════════════════

describe("PUT /api/students/[studentId]/availability — ownership", () => {
  it("returns 403 when caller does not own the student", async () => {
    const { student } = await seedOwnerWithStudent();
    const other = await createAccount({ role: 1 });
    const otherCookies = await signSessionFor(other);

    const res = await call(PUT, {
      method: "PUT",
      cookies: otherCookies,
      params: { studentId: student.id },
      body: VALID_PUT_BODY,
    });
    expect(res.status).toBe(403);
  });

  it("does NOT write student_availabilities when ownership fails", async () => {
    const { student } = await seedOwnerWithStudent();
    const other = await createAccount({ role: 1 });
    const otherCookies = await signSessionFor(other);

    await call(PUT, {
      method: "PUT",
      cookies: otherCookies,
      params: { studentId: student.id },
      body: VALID_PUT_BODY,
    });

    const row = await getRow("student_availabilities", { student_id: student.id });
    expect(row).toBeNull();
  });
});

describe("PUT /api/students/[studentId]/availability — input validation", () => {
  it("returns 400 when studentId is not a UUID", async () => {
    const { cookies } = await seedOwnerWithStudent();
    const res = await call(PUT, {
      method: "PUT",
      cookies,
      params: { studentId: "not-a-uuid" },
      body: VALID_PUT_BODY,
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when availability key is missing", async () => {
    const { cookies, student } = await seedOwnerWithStudent();
    const res = await call(PUT, {
      method: "PUT",
      cookies,
      params: { studentId: student.id },
      body: { timezone: "America/New_York" },
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when timezone is missing", async () => {
    const { cookies, student } = await seedOwnerWithStudent();
    const res = await call(PUT, {
      method: "PUT",
      cookies,
      params: { studentId: student.id },
      body: { availability: { Monday: [] } },
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when timezone is not a valid IANA name", async () => {
    const { cookies, student } = await seedOwnerWithStudent();
    const res = await call(PUT, {
      method: "PUT",
      cookies,
      params: { studentId: student.id },
      body: { ...VALID_PUT_BODY, timezone: "Mars/Base" },
    });
    expect(res.status).toBe(400);
  });
});

describe("PUT /api/students/[studentId]/availability — response + side effects", () => {
  it("returns { success: true } on update", async () => {
    const { cookies, student } = await seedOwnerWithStudent();
    const res = await call(PUT, {
      method: "PUT",
      cookies,
      params: { studentId: student.id },
      body: VALID_PUT_BODY,
    });
    expect(res.status).toBe(200);
    const body = await res.json<{ success: boolean }>();
    expect(body).toEqual({ success: true });
  });

  it("persists a row to student_availabilities on success", async () => {
    const { cookies, student } = await seedOwnerWithStudent();
    await call(PUT, {
      method: "PUT",
      cookies,
      params: { studentId: student.id },
      body: VALID_PUT_BODY,
    });

    const row = await expectRowExists("student_availabilities", {
      student_id: student.id,
      weekday: 1, // Monday
    });
    expect(row).toBeTruthy();
  });

  it("accepts and persists a valid global IANA timezone", async () => {
    const { cookies, student } = await seedOwnerWithStudent();
    const res = await call(PUT, {
      method: "PUT",
      cookies,
      params: { studentId: student.id },
      body: { ...VALID_PUT_BODY, timezone: "Europe/London" },
    });

    expect(res.status).toBe(200);

    const row = await expectRowExists("student_availabilities", {
      student_id: student.id,
      weekday: 1,
    });
    expect(row.timezone).toBe("Europe/London");
  });
});
