/**
 * Contract tests for GET /api/students/[studentId]/lessons.
 *
 * Coach leg of the role-dispatched route (admin leg is gated by role alone).
 * Both delegate to src/lib/lessons/server/getStudentLessonsByCourse; the only
 * difference is the ownership gate.
 *
 * Five questions:
 *   Q1 ownership — assertCoachAssignedToStudent (403 if not linked)
 *   Q2 validation — studentId must be a UUID
 *   Q3 response — { courses: [...] }
 *   Q4 side effects — none (read-only)
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

import { GET as lessonsGET } from "@/src/app/api/students/[studentId]/lessons/route";

beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterAll(() => server.close());
beforeEach(resetAll);

async function seedCoachLinkedToStudent() {
  const { account: coachAccount, coach } = await createCoach();
  const family = await createAccount({ role: 1 });
  const student = await createStudent(family);
  await linkCoachToStudent(coach, student);
  const cookies = await signSessionFor(coachAccount);
  return { coachAccount, coach, cookies, student };
}

// Q1
describe("GET /api/students/[studentId]/lessons — ownership", () => {
  it("returns 403 when the coach is not linked to the student", async () => {
    const { cookies } = await seedCoachLinkedToStudent();
    const otherFamily = await createAccount({ role: 1 });
    const otherStudent = await createStudent(otherFamily);

    const res = await call(lessonsGET, {
      cookies,
      params: { studentId: otherStudent.id },
    });
    expect(res.status).toBe(403);
  });
});

// Q2
describe("GET /api/students/[studentId]/lessons — input validation", () => {
  it("returns 400 when studentId is not a UUID", async () => {
    const { cookies } = await seedCoachLinkedToStudent();
    const res = await call(lessonsGET, {
      cookies,
      params: { studentId: "not-a-uuid" },
    });
    expect(res.status).toBe(400);
  });
});

// Q3
describe("GET /api/students/[studentId]/lessons — response shape", () => {
  it("returns { courses: [] } when the student has no assignments", async () => {
    const { cookies, student } = await seedCoachLinkedToStudent();
    const res = await call(lessonsGET, {
      cookies,
      params: { studentId: student.id },
    });
    expect(res.status).toBe(200);
    const body = await res.json<{ courses: unknown[] }>();
    expect(Array.isArray(body.courses)).toBe(true);
    expect(body.courses).toEqual([]);
  });

  it("returns the student's assigned courses with their lessons", async () => {
    const adminDb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    const { cookies, student } = await seedCoachLinkedToStudent();

    const { data: course } = await adminDb
      .from("courses")
      .insert({ title: `Course-${Date.now()}` })
      .select()
      .single();
    await adminDb
      .from("lessons")
      .insert({
        course_id: course!.id,
        title: "L1",
        slug: `lesson-${Date.now()}`,
      });
    await adminDb
      .from("course_assignment")
      .insert({ course_id: course!.id, student_id: student.id, progress: 0, isActive: true });

    const res = await call(lessonsGET, {
      cookies,
      params: { studentId: student.id },
    });
    expect(res.status).toBe(200);
    const body = await res.json<{
      courses: Array<{ course_id: string; course_name: string; lessons: unknown[] }>;
    }>();
    expect(body.courses.length).toBe(1);
    expect(body.courses[0].course_id).toBe(course!.id);
    expect(body.courses[0].lessons.length).toBe(1);
  });
});
