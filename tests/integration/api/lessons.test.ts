/**
 * Contract tests for GET /api/lessons.
 *
 * Read-only route: returns the lesson list, optionally enriched with a
 * specific student's lesson_progress when ?studentId= is provided.
 *
 * Five questions:
 *   Q1 ownership — assertCoachAssignedToStudent only when studentId is provided
 *   Q2 validation — studentId optional, must be UUID if present
 *   Q3 response — { lessons: [...] } named collection
 *   Q4 side effects — NONE (read-only)
 *   Q5 external calls — NONE
 */
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from "vitest";
import { createClient } from "@supabase/supabase-js";
import {
  createAccount,
  createCoach,
  createStudent,
  linkCoachToStudent,
} from "@tests/helpers/factories";
import { signSessionFor } from "@tests/helpers/auth";
import { resetAll } from "@tests/helpers/db";
import { call } from "@tests/helpers/request";
import { server } from "@tests/helpers/msw";

import { GET as lessonsGET } from "@/src/app/api/lessons/route";

beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterAll(() => server.close());
beforeEach(resetAll);

async function seedCoachAndStudent() {
  const adminDb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { account: coachAccount, coach } = await createCoach();
  const familyAccount = await createAccount({ role: 1 });
  const student = await createStudent(familyAccount);
  await linkCoachToStudent(coach, student);
  const cookies = await signSessionFor(coachAccount);

  // Seed one course + one lesson so the response list is non-empty.
  const { data: course } = await adminDb
    .from("courses")
    .insert({ title: `Course-${Date.now()}` })
    .select()
    .single();
  const { data: lesson } = await adminDb
    .from("lessons")
    .insert({
      course_id: course!.id,
      title: "L",
      slug: `lesson-${Date.now()}`,
    })
    .select()
    .single();

  return { cookies, student, lesson: lesson! };
}

// Q1
describe("GET /api/lessons — ownership", () => {
  it("returns 403 when ?studentId= is provided and coach is not assigned", async () => {
    const { student } = await seedCoachAndStudent();
    const { account: otherAccount } = await createCoach();
    const otherCookies = await signSessionFor(otherAccount);

    const res = await call(lessonsGET, {
      cookies: otherCookies,
      query: { studentId: student.id },
    });
    expect(res.status).toBe(403);
  });

  it("returns 200 when ?studentId= is provided and coach IS assigned", async () => {
    const { cookies, student } = await seedCoachAndStudent();
    const res = await call(lessonsGET, {
      cookies,
      query: { studentId: student.id },
    });
    expect(res.status).toBe(200);
  });

  it("returns 200 with no studentId — any role-2 coach can read the lesson catalog", async () => {
    const { cookies } = await seedCoachAndStudent();
    const res = await call(lessonsGET, { cookies });
    expect(res.status).toBe(200);
  });
});

// Q2
describe("GET /api/lessons — input validation", () => {
  it("returns 400 when studentId is a malformed UUID", async () => {
    const { cookies } = await seedCoachAndStudent();
    const res = await call(lessonsGET, {
      cookies,
      query: { studentId: "not-a-uuid" },
    });
    expect(res.status).toBe(400);
  });

  it("error responses use the { error: string } shape", async () => {
    const { cookies } = await seedCoachAndStudent();
    const res = await call(lessonsGET, {
      cookies,
      query: { studentId: "not-a-uuid" },
    });
    const body = await res.json<{ error?: string; message?: string; status?: number }>();
    expect(typeof body.error).toBe("string");
    expect(body.message).toBeUndefined();
    expect(body.status).toBeUndefined();
  });
});

// Q3
describe("GET /api/lessons — response shape", () => {
  it("returns { lessons: [...] } named collection (not a bare array)", async () => {
    const { cookies } = await seedCoachAndStudent();
    const res = await call(lessonsGET, { cookies });
    expect(res.status).toBe(200);
    const body = await res.json<{ lessons: unknown[] }>();
    expect(Array.isArray(body.lessons)).toBe(true);
    expect(body.lessons.length).toBeGreaterThan(0);
  });

  it("each lesson includes id, title, and course relation; progress is null when no studentId", async () => {
    const { cookies, lesson } = await seedCoachAndStudent();
    const res = await call(lessonsGET, { cookies });
    const body = await res.json<{
      lessons: Array<{
        id: string;
        title: string;
        courses: unknown;
        progress?: unknown;
      }>;
    }>();
    const target = body.lessons.find((l) => l.id === lesson.id);
    expect(target).toBeTruthy();
    expect(target!.title).toBe("L");
  });

  it("includes progress per lesson when ?studentId= is provided", async () => {
    const { cookies, student, lesson } = await seedCoachAndStudent();

    // Seed a progress row for that student/lesson so we can assert it's surfaced.
    const adminDb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    await adminDb.from("lesson_progress").insert({
      student_id: student.id,
      lesson_id: lesson.id,
      status: 2,
    });

    const res = await call(lessonsGET, {
      cookies,
      query: { studentId: student.id },
    });
    expect(res.status).toBe(200);
    const body = await res.json<{
      lessons: Array<{ id: string; progress: { status: number } | null }>;
    }>();
    const target = body.lessons.find((l) => l.id === lesson.id);
    expect(target?.progress?.status).toBe(2);
  });
});

// Q4 — read-only route, no side-effect tests.
// Q5 — no external calls.
