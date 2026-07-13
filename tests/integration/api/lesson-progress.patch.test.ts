/**
 * Contract tests for PATCH /api/lesson-progress.
 *
 * Densest coach route: writes lesson_progress + cascades to student_tokens
 * (when a token exists for the lesson) and student_badges (when all lessons
 * in a course are done AND a badge is tied to that course).
 *
 * Five questions (per docs/api-contract.md + test-rewrite-runbook):
 *   Q1 WHO CAN CALL IT?       — ownership (assertCoachAssignedToStudent)
 *   Q2 WHAT INPUTS?           — Zod: UUIDs + status ∈ {1,2,3} + .strict()
 *   Q3 WHAT DOES IT RETURN?   — the upserted lesson_progress row
 *   Q4 WHAT DOES IT PERSIST?  — lesson_progress + cascade to student_tokens
 *                                and student_badges based on status + course state
 *   Q5 WHAT EXTERNAL CALLS?   — none; this route is DB-only
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
import { expectRowExists, expectNoRow, getRow } from "@tests/helpers/sideEffects";

import { PATCH as progressPATCH } from "@/src/app/api/lesson-progress/route";

beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterAll(() => server.close());
beforeEach(resetAll);

/**
 * Seed a coach linked to a student plus a course with N lessons.
 * Optionally seeds a token tied to lesson 0 and a badge tied to the course.
 */
async function seedCourseAndLessons(opts: {
  lessonCount?: number;
  withTokenOnLessonIndex?: number;
  withBadgeOnCourse?: boolean;
}) {
  const adminDb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { account: coachAccount, coach } = await createCoach();
  const familyAccount = await createAccount({ role: 1 });
  const student = await createStudent(familyAccount);
  await linkCoachToStudent(coach, student);
  const cookies = await signSessionFor(coachAccount);

  const { data: course } = await adminDb
    .from("courses")
    .insert({ title: `Course-${Date.now()}` })
    .select()
    .single();

  const lessonCount = opts.lessonCount ?? 1;
  const lessons: { id: string }[] = [];
  for (let i = 0; i < lessonCount; i++) {
    const { data: lesson } = await adminDb
      .from("lessons")
      .insert({
        course_id: course!.id,
        title: `Lesson ${i + 1}`,
        slug: `lesson-${Date.now()}-${i}`,
      })
      .select("id")
      .single();
    lessons.push(lesson!);
  }

  let tokenId: string | null = null;
  if (opts.withTokenOnLessonIndex !== undefined) {
    const lessonForToken = lessons[opts.withTokenOnLessonIndex];
    const { data: token } = await adminDb
      .from("tokens")
      .insert({
        lesson_id: lessonForToken.id,
        code: `tok-${Date.now()}-${opts.withTokenOnLessonIndex}`,
        title: "Test Token",
      })
      .select("id")
      .single();
    tokenId = token!.id;
  }

  let badgeId: string | null = null;
  if (opts.withBadgeOnCourse) {
    const { data: badge } = await adminDb
      .from("badges")
      .insert({ course_id: course!.id, title: "Test Badge" })
      .select("id")
      .single();
    badgeId = badge!.id;
  }

  return {
    coachAccount,
    coach,
    student,
    cookies,
    course: course!,
    lessons,
    tokenId,
    badgeId,
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// Q1: WHO CAN CALL IT?
// ═════════════════════════════════════════════════════════════════════════════

describe("PATCH /api/lesson-progress — ownership", () => {
  it("returns 403 when a coach updates progress for a student they don't own", async () => {
    const { student, lessons } = await seedCourseAndLessons({ lessonCount: 1 });

    // A second coach NOT linked to this student.
    const { account: otherCoachAccount } = await createCoach();
    const otherCookies = await signSessionFor(otherCoachAccount);

    const res = await call(progressPATCH, {
      method: "PATCH",
      cookies: otherCookies,
      body: { student_id: student.id, lesson_id: lessons[0].id, status: 2 },
    });
    expect(res.status).toBe(403);
  });

  it("does NOT write lesson_progress when ownership check fails", async () => {
    const { student, lessons } = await seedCourseAndLessons({ lessonCount: 1 });
    const { account: otherCoachAccount } = await createCoach();
    const otherCookies = await signSessionFor(otherCoachAccount);

    await call(progressPATCH, {
      method: "PATCH",
      cookies: otherCookies,
      body: { student_id: student.id, lesson_id: lessons[0].id, status: 2 },
    });

    await expectNoRow("lesson_progress", {
      student_id: student.id,
      lesson_id: lessons[0].id,
    });
  });

  it("returns 200 when the assigned coach updates progress for their own student", async () => {
    const { cookies, student, lessons } = await seedCourseAndLessons({
      lessonCount: 1,
    });

    const res = await call(progressPATCH, {
      method: "PATCH",
      cookies,
      body: { student_id: student.id, lesson_id: lessons[0].id, status: 2 },
    });
    expect(res.status).toBe(200);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Q2: WHAT INPUTS DOES IT ACCEPT?
// ═════════════════════════════════════════════════════════════════════════════

describe("PATCH /api/lesson-progress — input validation", () => {
  it("returns 400 when student_id is missing", async () => {
    const { cookies, lessons } = await seedCourseAndLessons({ lessonCount: 1 });
    const res = await call(progressPATCH, {
      method: "PATCH",
      cookies,
      body: { lesson_id: lessons[0].id, status: 2 },
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when lesson_id is missing", async () => {
    const { cookies, student } = await seedCourseAndLessons({ lessonCount: 1 });
    const res = await call(progressPATCH, {
      method: "PATCH",
      cookies,
      body: { student_id: student.id, status: 2 },
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when status is not in {1, 2, 3}", async () => {
    const { cookies, student, lessons } = await seedCourseAndLessons({
      lessonCount: 1,
    });
    const res = await call(progressPATCH, {
      method: "PATCH",
      cookies,
      body: { student_id: student.id, lesson_id: lessons[0].id, status: 99 },
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when student_id is a malformed UUID", async () => {
    const { cookies, lessons } = await seedCourseAndLessons({ lessonCount: 1 });
    const res = await call(progressPATCH, {
      method: "PATCH",
      cookies,
      body: { student_id: "not-a-uuid", lesson_id: lessons[0].id, status: 2 },
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when body contains unknown fields (strict)", async () => {
    const { cookies, student, lessons } = await seedCourseAndLessons({
      lessonCount: 1,
    });
    const res = await call(progressPATCH, {
      method: "PATCH",
      cookies,
      body: {
        student_id: student.id,
        lesson_id: lessons[0].id,
        status: 2,
        extraneous: "field",
      },
    });
    expect(res.status).toBe(400);
  });

  it("error responses use the { error: string } shape", async () => {
    const { cookies } = await seedCourseAndLessons({ lessonCount: 1 });
    const res = await call(progressPATCH, {
      method: "PATCH",
      cookies,
      body: { status: 2 },
    });
    const body = await res.json<{ error?: string; message?: string; status?: number }>();
    expect(typeof body.error).toBe("string");
    expect(body.message).toBeUndefined();
    expect(body.status).toBeUndefined();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Q3: WHAT DOES IT RETURN ON SUCCESS?
// ═════════════════════════════════════════════════════════════════════════════

describe("PATCH /api/lesson-progress — response shape", () => {
  it("returns the upserted lesson_progress row", async () => {
    const { cookies, student, lessons } = await seedCourseAndLessons({
      lessonCount: 1,
    });

    const res = await call(progressPATCH, {
      method: "PATCH",
      cookies,
      body: { student_id: student.id, lesson_id: lessons[0].id, status: 2 },
    });
    expect(res.status).toBe(200);

    const body = await res.json<{
      student_id: string;
      lesson_id: string;
      status: number;
    }>();
    expect(body.student_id).toBe(student.id);
    expect(body.lesson_id).toBe(lessons[0].id);
    expect(body.status).toBe(2);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Q4: WHAT DOES IT PERSIST?
// The dense part of this route — token + badge side effects cascade off
// lesson_progress writes.
// ═════════════════════════════════════════════════════════════════════════════

describe("PATCH /api/lesson-progress — side effects on lesson_progress", () => {
  it("upserts lesson_progress with completed_at SET when status=3", async () => {
    const { cookies, student, lessons } = await seedCourseAndLessons({
      lessonCount: 1,
    });

    await call(progressPATCH, {
      method: "PATCH",
      cookies,
      body: { student_id: student.id, lesson_id: lessons[0].id, status: 3 },
    });

    const row = await expectRowExists("lesson_progress", {
      student_id: student.id,
      lesson_id: lessons[0].id,
    });
    expect(row.status).toBe(3);
    expect(row.completed_at).not.toBeNull();
  });

  it("upserts lesson_progress with completed_at NULL when status=2", async () => {
    const { cookies, student, lessons } = await seedCourseAndLessons({
      lessonCount: 1,
    });

    await call(progressPATCH, {
      method: "PATCH",
      cookies,
      body: { student_id: student.id, lesson_id: lessons[0].id, status: 2 },
    });

    const row = await expectRowExists("lesson_progress", {
      student_id: student.id,
      lesson_id: lessons[0].id,
    });
    expect(row.status).toBe(2);
    expect(row.completed_at).toBeNull();
  });
});

describe("PATCH /api/lesson-progress — side effects on student_tokens", () => {
  it("creates a student_tokens row when status=3 and a token exists for the lesson", async () => {
    const { cookies, student, lessons, tokenId } = await seedCourseAndLessons({
      lessonCount: 1,
      withTokenOnLessonIndex: 0,
    });

    await call(progressPATCH, {
      method: "PATCH",
      cookies,
      body: { student_id: student.id, lesson_id: lessons[0].id, status: 3 },
    });

    await expectRowExists("student_tokens", {
      student_id: student.id,
      token_id: tokenId!,
    });
  });

  it("deletes student_tokens row when status flips from 3 back to 2", async () => {
    const { cookies, student, lessons, tokenId } = await seedCourseAndLessons({
      lessonCount: 1,
      withTokenOnLessonIndex: 0,
    });

    // First mark as done so the token gets awarded.
    await call(progressPATCH, {
      method: "PATCH",
      cookies,
      body: { student_id: student.id, lesson_id: lessons[0].id, status: 3 },
    });
    // Then revert.
    await call(progressPATCH, {
      method: "PATCH",
      cookies,
      body: { student_id: student.id, lesson_id: lessons[0].id, status: 2 },
    });

    await expectNoRow("student_tokens", {
      student_id: student.id,
      token_id: tokenId!,
    });
  });
});

describe("PATCH /api/lesson-progress — side effects on student_badges", () => {
  it("creates student_badges row when status=3 AND every lesson in the course is done AND a badge is tied to the course", async () => {
    const { cookies, student, lessons, badgeId } = await seedCourseAndLessons({
      lessonCount: 2,
      withBadgeOnCourse: true,
    });

    // Mark first lesson done.
    await call(progressPATCH, {
      method: "PATCH",
      cookies,
      body: { student_id: student.id, lesson_id: lessons[0].id, status: 3 },
    });
    // Before all done — badge should NOT exist yet.
    const beforeAllDone = await getRow("student_badges", {
      student_id: student.id,
      badge_id: badgeId!,
    });
    expect(beforeAllDone).toBeNull();

    // Mark second (and final) lesson done.
    await call(progressPATCH, {
      method: "PATCH",
      cookies,
      body: { student_id: student.id, lesson_id: lessons[1].id, status: 3 },
    });

    await expectRowExists("student_badges", {
      student_id: student.id,
      badge_id: badgeId!,
    });
  });

  it("deletes student_badges row when any course lesson reverts from 3 to 2", async () => {
    const { cookies, student, lessons, badgeId } = await seedCourseAndLessons({
      lessonCount: 2,
      withBadgeOnCourse: true,
    });

    // Mark both lessons done so the badge is awarded.
    await call(progressPATCH, {
      method: "PATCH",
      cookies,
      body: { student_id: student.id, lesson_id: lessons[0].id, status: 3 },
    });
    await call(progressPATCH, {
      method: "PATCH",
      cookies,
      body: { student_id: student.id, lesson_id: lessons[1].id, status: 3 },
    });
    await expectRowExists("student_badges", {
      student_id: student.id,
      badge_id: badgeId!,
    });

    // Now revert one lesson back to in-progress.
    await call(progressPATCH, {
      method: "PATCH",
      cookies,
      body: { student_id: student.id, lesson_id: lessons[0].id, status: 2 },
    });

    await expectNoRow("student_badges", {
      student_id: student.id,
      badge_id: badgeId!,
    });
  });

  it("does NOT create student_badges when status=3 but not every course lesson is done", async () => {
    const { cookies, student, lessons, badgeId } = await seedCourseAndLessons({
      lessonCount: 2,
      withBadgeOnCourse: true,
    });

    await call(progressPATCH, {
      method: "PATCH",
      cookies,
      body: { student_id: student.id, lesson_id: lessons[0].id, status: 3 },
    });

    await expectNoRow("student_badges", {
      student_id: student.id,
      badge_id: badgeId!,
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Q5: WHAT EXTERNAL CALLS DID IT MAKE?
// This route is DB-only — no Stripe, no LessonSpace, no Resend. The "external
// calls" question collapses to "doesn't touch any HTTP service."
// Sanity-asserting via MSW's onUnhandledRequest: "error" would be noisy; instead
// we just don't seed any handlers and trust that the route doesn't surprise us.
// ═════════════════════════════════════════════════════════════════════════════
