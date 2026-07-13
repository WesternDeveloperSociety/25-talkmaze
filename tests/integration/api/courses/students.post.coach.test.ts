/**
 * Contract tests for POST /api/courses/[courseId]/students (coach leg).
 *
 * Coach leg of the admin/coach role-dispatched route — same body, same
 * { success: true } response, same side effects as the admin leg. The
 * difference is auth: coach role (2) + coach_students ownership of the
 * student.
 *
 * Five questions:
 *   Q1 ownership — assertCoachAssignedToStudent (403 if not linked)
 *   Q2 validation — studentId UUID, courseId UUID, .strict()
 *   Q3 response — { success: true }
 *   Q4 side effects — course_assignment row + N lesson_progress rows
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

import { POST as assignPOST } from "@/src/app/api/courses/[courseId]/students/route";

beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterAll(() => server.close());
beforeEach(resetAll);

async function seedCoachWithLinkedStudentAndCourse(lessonCount = 2) {
  const adminDb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { account: coachAccount, coach } = await createCoach();
  const family = await createAccount({ role: 1 });
  const student = await createStudent(family);
  await linkCoachToStudent(coach, student);
  const cookies = await signSessionFor(coachAccount);

  const { data: course } = await adminDb
    .from("courses")
    .insert({ title: `Course-${Date.now()}` })
    .select()
    .single();

  const lessonIds: string[] = [];
  for (let i = 0; i < lessonCount; i++) {
    const { data: lesson } = await adminDb
      .from("lessons")
      .insert({
        course_id: course!.id,
        title: `L${i + 1}`,
        slug: `lesson-${Date.now()}-${i}`,
      })
      .select("id")
      .single();
    lessonIds.push(lesson!.id);
  }

  return { coachAccount, coach, cookies, student, course: course!, lessonIds };
}

// Q1
describe("POST /api/courses/[courseId]/students — ownership (coach)", () => {
  it("returns 403 when the coach is not linked to the target student", async () => {
    const { cookies, course } = await seedCoachWithLinkedStudentAndCourse();
    // Unlinked student under a different family.
    const otherFamily = await createAccount({ role: 1 });
    const otherStudent = await createStudent(otherFamily);

    const res = await call(assignPOST, {
      method: "POST",
      cookies,
      params: { courseId: course.id },
      body: { studentId: otherStudent.id },
    });
    expect(res.status).toBe(403);
    await expectNoRow("course_assignment", {
      course_id: course.id,
      student_id: otherStudent.id,
    });
  });
});

// Q2
describe("POST /api/courses/[courseId]/students — input validation (coach)", () => {
  it("returns 400 when studentId is not a UUID", async () => {
    const { cookies, course } = await seedCoachWithLinkedStudentAndCourse();
    const res = await call(assignPOST, {
      method: "POST",
      cookies,
      params: { courseId: course.id },
      body: { studentId: "not-a-uuid" },
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when courseId is not a UUID", async () => {
    const { cookies, student } = await seedCoachWithLinkedStudentAndCourse();
    const res = await call(assignPOST, {
      method: "POST",
      cookies,
      params: { courseId: "not-a-uuid" },
      body: { studentId: student.id },
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when body contains unknown fields (strict)", async () => {
    const { cookies, student, course } = await seedCoachWithLinkedStudentAndCourse();
    const res = await call(assignPOST, {
      method: "POST",
      cookies,
      params: { courseId: course.id },
      body: { studentId: student.id, extraneous: "field" },
    });
    expect(res.status).toBe(400);
  });

  it("error responses use the { error: string } shape", async () => {
    const { cookies, course } = await seedCoachWithLinkedStudentAndCourse();
    const res = await call(assignPOST, {
      method: "POST",
      cookies,
      params: { courseId: course.id },
      body: { studentId: "not-a-uuid" },
    });
    const body = await res.json<{ error?: string; message?: string; status?: number }>();
    expect(typeof body.error).toBe("string");
    expect(body.message).toBeUndefined();
    expect(body.status).toBeUndefined();
  });
});

// Q3
describe("POST /api/courses/[courseId]/students — response shape (coach)", () => {
  it("returns { success: true } on success", async () => {
    const { cookies, student, course } = await seedCoachWithLinkedStudentAndCourse();
    const res = await call(assignPOST, {
      method: "POST",
      cookies,
      params: { courseId: course.id },
      body: { studentId: student.id },
    });
    expect(res.status).toBe(200);
    const body = await res.json<{ success: boolean }>();
    expect(body).toEqual({ success: true });
  });
});

// Q4
describe("POST /api/courses/[courseId]/students — side effects (coach)", () => {
  it("creates one course_assignment row", async () => {
    const { cookies, student, course } = await seedCoachWithLinkedStudentAndCourse();
    await call(assignPOST, {
      method: "POST",
      cookies,
      params: { courseId: course.id },
      body: { studentId: student.id },
    });
    await expectRowExists("course_assignment", {
      course_id: course.id,
      student_id: student.id,
    });
  });

  it("creates one lesson_progress row per lesson in the course", async () => {
    const { cookies, student, course, lessonIds } =
      await seedCoachWithLinkedStudentAndCourse(3);
    await call(assignPOST, {
      method: "POST",
      cookies,
      params: { courseId: course.id },
      body: { studentId: student.id },
    });
    for (const lessonId of lessonIds) {
      await expectRowExists("lesson_progress", {
        student_id: student.id,
        lesson_id: lessonId,
      });
    }
    void course;
  });

  it("does NOT write course_assignment when ownership fails", async () => {
    const { cookies, course } = await seedCoachWithLinkedStudentAndCourse();
    const otherFamily = await createAccount({ role: 1 });
    const otherStudent = await createStudent(otherFamily);

    await call(assignPOST, {
      method: "POST",
      cookies,
      params: { courseId: course.id },
      body: { studentId: otherStudent.id },
    });
    await expectNoRow("course_assignment", {
      course_id: course.id,
      student_id: otherStudent.id,
    });
  });

  it("does NOT write course_assignment when body is invalid", async () => {
    const { cookies, course } = await seedCoachWithLinkedStudentAndCourse();
    await call(assignPOST, {
      method: "POST",
      cookies,
      params: { courseId: course.id },
      body: { studentId: "not-a-uuid" },
    });
    await expectNoRow("course_assignment", { course_id: course.id });
  });
});
