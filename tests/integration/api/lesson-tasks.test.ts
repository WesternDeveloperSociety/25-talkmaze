/**
 * Contract tests for PATCH /api/lesson-tasks.
 *
 * Upserts (or deletes) a coach-set per-student override for a lesson's
 * pre/post task. Accepts multipart/form-data. Audit-flagged today:
 *   - No requireRole / no ownership check (any authed user can mutate any
 *     student's lesson_tasks).
 *   - Uses service-role storage client outside webhook scope.
 *   - No Zod validation.
 *
 * Five questions:
 *   Q1 ownership — assertCoachAssignedToStudent(student_id)
 *   Q2 validation — student_id/lesson_id/course_id UUIDs; type ∈ {pre, post}
 *   Q3 response — { task: row } on upsert; { deleted: true } on remove
 *   Q4 side effects — lesson_tasks row created/updated/removed
 *   Q5 external calls — no external calls in the description-only path
 *
 * NOTE: file-upload paths exercise Supabase Storage which is heavier to test
 * (separate storage bucket setup). This file focuses on the description-only
 * branch — that's where the contract bugs live (auth/ownership/Zod). File
 * branches are exercised via manual testing + the existing UI.
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

import { PATCH as lessonTasksPATCH } from "@/src/app/api/lesson-tasks/route";

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

  return {
    coachAccount,
    student,
    cookies,
    course: course!,
    lesson: lesson!,
  };
}

/** Build a description-only FormData (no file). */
function descriptionForm(opts: {
  student_id: string;
  lesson_id: string;
  course_id: string;
  type?: "pre" | "post";
  description?: string;
}) {
  const fd = new FormData();
  fd.set("student_id", opts.student_id);
  fd.set("lesson_id", opts.lesson_id);
  fd.set("course_id", opts.course_id);
  fd.set("type", opts.type ?? "pre");
  fd.set("description", opts.description ?? "<p>do this</p>");
  return fd;
}

// ═════════════════════════════════════════════════════════════════════════════
// Q1: WHO CAN CALL IT?
// ═════════════════════════════════════════════════════════════════════════════

describe("PATCH /api/lesson-tasks — ownership", () => {
  it("returns 403 when a coach acts on a student they don't own", async () => {
    const { student, lesson, course } = await seedCoachStudentLesson();
    const { account: otherCoachAccount } = await createCoach();
    const otherCookies = await signSessionFor(otherCoachAccount);

    const res = await call(lessonTasksPATCH, {
      method: "PATCH",
      cookies: otherCookies,
      formData: descriptionForm({
        student_id: student.id,
        lesson_id: lesson.id,
        course_id: course.id,
      }),
    });
    expect(res.status).toBe(403);
  });

  it("does NOT write lesson_tasks when ownership fails", async () => {
    const { student, lesson, course } = await seedCoachStudentLesson();
    const { account: otherCoachAccount } = await createCoach();
    const otherCookies = await signSessionFor(otherCoachAccount);

    await call(lessonTasksPATCH, {
      method: "PATCH",
      cookies: otherCookies,
      formData: descriptionForm({
        student_id: student.id,
        lesson_id: lesson.id,
        course_id: course.id,
      }),
    });

    await expectNoRow("lesson_tasks", {
      student_id: student.id,
      lesson_id: lesson.id,
    });
  });

  it("returns 200 when assigned coach acts on their own student", async () => {
    const { cookies, student, lesson, course } = await seedCoachStudentLesson();
    const res = await call(lessonTasksPATCH, {
      method: "PATCH",
      cookies,
      formData: descriptionForm({
        student_id: student.id,
        lesson_id: lesson.id,
        course_id: course.id,
      }),
    });
    expect(res.status).toBe(200);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Q2: WHAT INPUTS DOES IT ACCEPT?
// ═════════════════════════════════════════════════════════════════════════════

describe("PATCH /api/lesson-tasks — input validation", () => {
  it("returns 400 when student_id is missing", async () => {
    const { cookies, lesson, course } = await seedCoachStudentLesson();
    const fd = new FormData();
    fd.set("lesson_id", lesson.id);
    fd.set("course_id", course.id);
    fd.set("type", "pre");
    fd.set("description", "<p>x</p>");

    const res = await call(lessonTasksPATCH, {
      method: "PATCH",
      cookies,
      formData: fd,
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when student_id is malformed (not a UUID)", async () => {
    const { cookies, lesson, course } = await seedCoachStudentLesson();
    const res = await call(lessonTasksPATCH, {
      method: "PATCH",
      cookies,
      formData: descriptionForm({
        student_id: "not-a-uuid",
        lesson_id: lesson.id,
        course_id: course.id,
      }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when type is neither 'pre' nor 'post'", async () => {
    const { cookies, student, lesson, course } = await seedCoachStudentLesson();
    const fd = new FormData();
    fd.set("student_id", student.id);
    fd.set("lesson_id", lesson.id);
    fd.set("course_id", course.id);
    fd.set("type", "bogus");
    fd.set("description", "<p>x</p>");

    const res = await call(lessonTasksPATCH, {
      method: "PATCH",
      cookies,
      formData: fd,
    });
    expect(res.status).toBe(400);
  });

  it("error responses use the { error: string } shape", async () => {
    const { cookies, lesson, course } = await seedCoachStudentLesson();
    const res = await call(lessonTasksPATCH, {
      method: "PATCH",
      cookies,
      formData: descriptionForm({
        student_id: "not-a-uuid",
        lesson_id: lesson.id,
        course_id: course.id,
      }),
    });
    const body = await res.json<{ error?: string; message?: string; status?: number }>();
    expect(typeof body.error).toBe("string");
    expect(body.message).toBeUndefined();
    expect(body.status).toBeUndefined();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Q3 + Q4: response shape + side effects (description-only path)
// ═════════════════════════════════════════════════════════════════════════════

describe("PATCH /api/lesson-tasks — upsert with description only", () => {
  it("creates a lesson_tasks row with the description on first call", async () => {
    const { cookies, student, lesson, course } = await seedCoachStudentLesson();

    await call(lessonTasksPATCH, {
      method: "PATCH",
      cookies,
      formData: descriptionForm({
        student_id: student.id,
        lesson_id: lesson.id,
        course_id: course.id,
        type: "pre",
        description: "<p>first version</p>",
      }),
    });

    const row = await expectRowExists("lesson_tasks", {
      student_id: student.id,
      lesson_id: lesson.id,
      type: "pre",
    });
    expect(row.description).toBe("<p>first version</p>");
    expect(row.file_url).toBeNull();
  });

  it("updates the existing lesson_tasks description on second call (idempotent upsert)", async () => {
    const { cookies, student, lesson, course } = await seedCoachStudentLesson();

    await call(lessonTasksPATCH, {
      method: "PATCH",
      cookies,
      formData: descriptionForm({
        student_id: student.id,
        lesson_id: lesson.id,
        course_id: course.id,
        description: "<p>v1</p>",
      }),
    });
    await call(lessonTasksPATCH, {
      method: "PATCH",
      cookies,
      formData: descriptionForm({
        student_id: student.id,
        lesson_id: lesson.id,
        course_id: course.id,
        description: "<p>v2</p>",
      }),
    });

    const row = await expectRowExists("lesson_tasks", {
      student_id: student.id,
      lesson_id: lesson.id,
      type: "pre",
    });
    expect(row.description).toBe("<p>v2</p>");
  });
});

describe("PATCH /api/lesson-tasks — delete-when-empty path", () => {
  it("deletes the lesson_tasks row when description becomes empty and no file remains", async () => {
    const { cookies, student, lesson, course } = await seedCoachStudentLesson();

    // First seed an override row via the route itself.
    await call(lessonTasksPATCH, {
      method: "PATCH",
      cookies,
      formData: descriptionForm({
        student_id: student.id,
        lesson_id: lesson.id,
        course_id: course.id,
        description: "<p>seed</p>",
      }),
    });
    await expectRowExists("lesson_tasks", {
      student_id: student.id,
      lesson_id: lesson.id,
    });

    // Now PATCH with an empty description and no file.
    await call(lessonTasksPATCH, {
      method: "PATCH",
      cookies,
      formData: descriptionForm({
        student_id: student.id,
        lesson_id: lesson.id,
        course_id: course.id,
        description: "<p></p>",
      }),
    });

    await expectNoRow("lesson_tasks", {
      student_id: student.id,
      lesson_id: lesson.id,
    });
  });

  it("returns { deleted: true } when the override is removed", async () => {
    const { cookies, student, lesson, course } = await seedCoachStudentLesson();

    // Seed first.
    await call(lessonTasksPATCH, {
      method: "PATCH",
      cookies,
      formData: descriptionForm({
        student_id: student.id,
        lesson_id: lesson.id,
        course_id: course.id,
        description: "<p>seed</p>",
      }),
    });

    const res = await call(lessonTasksPATCH, {
      method: "PATCH",
      cookies,
      formData: descriptionForm({
        student_id: student.id,
        lesson_id: lesson.id,
        course_id: course.id,
        description: "",
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json<{ deleted?: boolean }>();
    expect(body.deleted).toBe(true);
  });
});

// Q5 — file-upload external calls are exercised via UI/manual testing; this
// file's contract focus is the auth/ownership/Zod gates and the description-
// only path. The Stripe-style "external call" assertion doesn't apply here.
