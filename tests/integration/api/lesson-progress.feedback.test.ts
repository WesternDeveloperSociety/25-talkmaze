/**
 * Contract tests for PATCH /api/lesson-progress/feedback.
 *
 * Upserts coach feedback (HTML strings) onto the lesson_progress row for a
 * student/lesson pair.
 *
 * Five questions:
 *   Q1 ownership — assertCoachAssignedToStudent
 *   Q2 validation — UUIDs, optional HTML fields, .strict()
 *   Q3 response — the upserted lesson_progress row
 *   Q4 side effects — lesson_progress.positive_feedback / improvement_feedback
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
import { expectRowExists, expectNoRow } from "@tests/helpers/sideEffects";

import { PATCH as feedbackPATCH } from "@/src/app/api/lesson-progress/feedback/route";

beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterAll(() => server.close());
beforeEach(resetAll);

async function seedCoachStudentLesson() {
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
describe("PATCH /api/lesson-progress/feedback — ownership", () => {
  it("returns 403 when coach is not assigned to student", async () => {
    const { student, lesson } = await seedCoachStudentLesson();
    const { account: otherAccount } = await createCoach();
    const otherCookies = await signSessionFor(otherAccount);

    const res = await call(feedbackPATCH, {
      method: "PATCH",
      cookies: otherCookies,
      body: {
        student_id: student.id,
        lesson_id: lesson.id,
        positive_feedback: "<p>x</p>",
        improvement_feedback: "<p>y</p>",
      },
    });
    expect(res.status).toBe(403);
  });

  it("does NOT write lesson_progress when ownership fails", async () => {
    const { student, lesson } = await seedCoachStudentLesson();
    const { account: otherAccount } = await createCoach();
    const otherCookies = await signSessionFor(otherAccount);

    await call(feedbackPATCH, {
      method: "PATCH",
      cookies: otherCookies,
      body: {
        student_id: student.id,
        lesson_id: lesson.id,
        positive_feedback: "<p>x</p>",
        improvement_feedback: "<p>y</p>",
      },
    });

    await expectNoRow("lesson_progress", {
      student_id: student.id,
      lesson_id: lesson.id,
    });
  });

  it("returns 200 when assigned coach writes feedback for their student", async () => {
    const { cookies, student, lesson } = await seedCoachStudentLesson();
    const res = await call(feedbackPATCH, {
      method: "PATCH",
      cookies,
      body: {
        student_id: student.id,
        lesson_id: lesson.id,
        positive_feedback: "<p>x</p>",
        improvement_feedback: "<p>y</p>",
      },
    });
    expect(res.status).toBe(200);
  });
});

// Q2
describe("PATCH /api/lesson-progress/feedback — input validation", () => {
  it("returns 400 when student_id is missing", async () => {
    const { cookies, lesson } = await seedCoachStudentLesson();
    const res = await call(feedbackPATCH, {
      method: "PATCH",
      cookies,
      body: { lesson_id: lesson.id, positive_feedback: "<p>x</p>" },
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when lesson_id is missing", async () => {
    const { cookies, student } = await seedCoachStudentLesson();
    const res = await call(feedbackPATCH, {
      method: "PATCH",
      cookies,
      body: { student_id: student.id, positive_feedback: "<p>x</p>" },
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when student_id is a malformed UUID", async () => {
    const { cookies, lesson } = await seedCoachStudentLesson();
    const res = await call(feedbackPATCH, {
      method: "PATCH",
      cookies,
      body: { student_id: "not-a-uuid", lesson_id: lesson.id },
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when body contains unknown fields (strict)", async () => {
    const { cookies, student, lesson } = await seedCoachStudentLesson();
    const res = await call(feedbackPATCH, {
      method: "PATCH",
      cookies,
      body: {
        student_id: student.id,
        lesson_id: lesson.id,
        extraneous: "field",
      },
    });
    expect(res.status).toBe(400);
  });

  it("error responses use the { error: string } shape", async () => {
    const { cookies } = await seedCoachStudentLesson();
    const res = await call(feedbackPATCH, {
      method: "PATCH",
      cookies,
      body: {},
    });
    const body = await res.json<{ error?: string; message?: string; status?: number }>();
    expect(typeof body.error).toBe("string");
    expect(body.message).toBeUndefined();
    expect(body.status).toBeUndefined();
  });
});

// Q3
describe("PATCH /api/lesson-progress/feedback — response shape", () => {
  it("returns the upserted lesson_progress row with feedback fields", async () => {
    const { cookies, student, lesson } = await seedCoachStudentLesson();
    const res = await call(feedbackPATCH, {
      method: "PATCH",
      cookies,
      body: {
        student_id: student.id,
        lesson_id: lesson.id,
        positive_feedback: "<p>great</p>",
        improvement_feedback: "<p>keep going</p>",
      },
    });
    expect(res.status).toBe(200);
    const body = await res.json<{
      student_id: string;
      lesson_id: string;
      positive_feedback: string;
      improvement_feedback: string;
    }>();
    expect(body.student_id).toBe(student.id);
    expect(body.lesson_id).toBe(lesson.id);
    expect(body.positive_feedback).toBe("<p>great</p>");
    expect(body.improvement_feedback).toBe("<p>keep going</p>");
  });
});

// Q4
describe("PATCH /api/lesson-progress/feedback — side effects", () => {
  it("persists feedback to lesson_progress on success", async () => {
    const { cookies, student, lesson } = await seedCoachStudentLesson();
    await call(feedbackPATCH, {
      method: "PATCH",
      cookies,
      body: {
        student_id: student.id,
        lesson_id: lesson.id,
        positive_feedback: "<p>persisted</p>",
        improvement_feedback: "<p>also persisted</p>",
      },
    });
    const row = await expectRowExists("lesson_progress", {
      student_id: student.id,
      lesson_id: lesson.id,
    });
    expect(row.positive_feedback).toBe("<p>persisted</p>");
    expect(row.improvement_feedback).toBe("<p>also persisted</p>");
  });

  it("accepts optional/null feedback fields (only one provided)", async () => {
    const { cookies, student, lesson } = await seedCoachStudentLesson();
    const res = await call(feedbackPATCH, {
      method: "PATCH",
      cookies,
      body: {
        student_id: student.id,
        lesson_id: lesson.id,
        positive_feedback: "<p>only this</p>",
      },
    });
    expect(res.status).toBe(200);
    const row = await expectRowExists("lesson_progress", {
      student_id: student.id,
      lesson_id: lesson.id,
    });
    expect(row.positive_feedback).toBe("<p>only this</p>");
    expect(row.improvement_feedback).toBeNull();
  });
});

// Q5 — DB-only, no external calls. No tests needed.
