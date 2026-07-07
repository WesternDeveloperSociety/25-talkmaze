/**
 * Role-gate matrix for every gated route in src/app/api/**.
 *
 * One declarative table iterates over every route the API exposes that is not
 * a webhook. For each route:
 *   - anonymous caller → 401  (skipped when publicSubFlow: true)
 *   - role ∉ allowed   → 403
 *   - role ∈ allowed   → not 401 and not 403 (response shape is up to the
 *     per-route file's 5-question test in tests/integration/api/<path>.test.ts)
 *
 * The matrix asserts the *contract* per docs/api-auth.md, not the current
 * behaviour. Routes missing auth today (CRITICAL audit findings) appear RED
 * here and turn GREEN when fixed in Phase 4.
 *
 * Adding a new route → add a row to the AUTH_CASES table below. That's it.
 * Changing a route's role policy → edit its `allowed` array.
 *
 * Replaces:
 *   - tests/integration/api/admin/auth.test.ts
 *   - tests/integration/api/admin/auth-extended.test.ts
 *   - the 401/403-for-wrong-role assertions previously scattered across
 *     tests/integration/api/coach/ownership.test.ts
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";

// Payment-plans + subscriptions routes call the shared Stripe client.
// Mock it so the allowed-role probes don't hang on real Stripe calls when
// auth is missing today and the route runs to completion.
vi.mock("@/src/services/stripe/client", () => ({
  stripe: {
    prices: {
      retrieve: vi.fn().mockResolvedValue({
        id: "price_test",
        unit_amount: 1000,
        currency: "usd",
        recurring: { interval: "month" },
        product: { id: "prod_test", name: "Test Product" },
      }),
    },
    products: { retrieve: vi.fn().mockResolvedValue({ id: "prod_test", name: "Test" }) },
    subscriptionSchedules: { release: vi.fn().mockResolvedValue({}) },
    subscriptions: { list: vi.fn().mockResolvedValue({ data: [] }), retrieve: vi.fn(), update: vi.fn(), create: vi.fn() },
    refunds: { create: vi.fn() },
    invoices: { retrieve: vi.fn(), list: vi.fn().mockResolvedValue({ data: [], has_more: false }) },
    customers: { create: vi.fn(), retrieve: vi.fn() },
    setupIntents: { create: vi.fn() },
  },
}));

import { resetAll } from "@tests/helpers/db";
import { call } from "@tests/helpers/request";
import { ANON, cookiesFor, type Role } from "@tests/helpers/auth";
import { server } from "@tests/helpers/msw";

// ── Route handlers ────────────────────────────────────────────────────────────

// Admin
import { GET as assignmentsGET, POST as assignmentsPOST } from "@/src/app/api/admin/assignments/route";
import { DELETE as assignmentsDELETE } from "@/src/app/api/admin/assignments/[id]/route";
import { GET as coursesGET, POST as coursesPOST } from "@/src/app/api/admin/courses/route";
import { PUT as coursesPUT, DELETE as coursesDELETE } from "@/src/app/api/admin/courses/[id]/route";
import { GET as courseLessonsGET, POST as courseLessonsPOST } from "@/src/app/api/admin/courses/[id]/lessons/route";
import { PUT as lessonPUT, DELETE as lessonDELETE } from "@/src/app/api/admin/courses/[id]/lessons/[lessonId]/route";
import { POST as courseAssignPOST } from "@/src/app/api/admin/courses/assign/route";
import { POST as createAdminPOST } from "@/src/app/api/admin/create-admin/route";
import { POST as createCoachPOST } from "@/src/app/api/admin/create-coach/route";
import { GET as employeesGET } from "@/src/app/api/admin/employees/route";
import { PUT as employeePUT } from "@/src/app/api/admin/employees/[id]/route";
import { GET as employeeAvailGET, PUT as employeeAvailPUT } from "@/src/app/api/admin/employees/[id]/availability/route";
import { GET as plansGET, POST as plansPOST } from "@/src/app/api/admin/payment-plans/route";
import { PATCH as planPATCH } from "@/src/app/api/admin/payment-plans/[id]/route";
import { PATCH as planArchivePATCH } from "@/src/app/api/admin/payment-plans/[id]/archive/route";
import { GET as stripePreviewGET } from "@/src/app/api/admin/payment-plans/stripe-preview/route";
import { GET as pendingGET } from "@/src/app/api/admin/pending-bookings/route";
import { PATCH as bookingPATCH } from "@/src/app/api/admin/pending-bookings/[id]/route";
import { POST as bookingPreviewPOST } from "@/src/app/api/admin/pending-bookings/[id]/preview/route";
import { POST as bookingApprovePOST } from "@/src/app/api/admin/pending-bookings/[id]/approve/route";
import { GET as studentsGET } from "@/src/app/api/admin/students/route";
import { PUT as studentPUT } from "@/src/app/api/admin/students/[id]/route";
import { GET as studentLessonsGET } from "@/src/app/api/admin/students/lessons/[studentId]/route";

// Coach
import { GET as coachConversationGET } from "@/src/app/api/coach/conversation/route";
import { GET as coachCoursesGET } from "@/src/app/api/coach/courses/route";
import { POST as coachCourseAssignPOST } from "@/src/app/api/coach/courses/assign/route";
import { GET as coachConversationMsgGET } from "@/src/app/api/coach/conversation/message/route";
import { PATCH as coachFeedbackPATCH } from "@/src/app/api/coach/lesson-feedback/route";
import { PATCH as coachProgressPATCH } from "@/src/app/api/coach/lesson-progress/route";
import { GET as coachLessonsGET } from "@/src/app/api/coach/lessons/route";
import { GET as coachLessonspaceGET } from "@/src/app/api/coach/lessonspace/[coachId]/[studentId]/route";
import { GET as coachSessionsGET } from "@/src/app/api/coach/sessions/route";
import { PATCH as coachSessionPATCH } from "@/src/app/api/coach/sessions/[id]/route";
import { GET as coachStudentsGET } from "@/src/app/api/coach/students/route";
import { GET as coachStudentLessonsGET } from "@/src/app/api/coach/students/lessons/[studentId]/route";
import { GET as coachStudentParentGET } from "@/src/app/api/coach/students/[studentId]/parent/route";

// Parent
import { PATCH as parentSetupPATCH } from "@/src/app/api/parent/setup/route";
import { GET as parentSessionsGET } from "@/src/app/api/parent/sessions/route";
import { GET as parentStudentsGET } from "@/src/app/api/parent/students/route";
import { GET as parentStudentGET } from "@/src/app/api/parent/students/[studentId]/route";
import { GET as parentStudentAvailGET, PUT as parentStudentAvailPUT } from "@/src/app/api/parent/students/[studentId]/availability/route";

// User / Profiles / Lesson-progress
import { GET as userRoleGET } from "@/src/app/api/user/role/route";
import { GET as lessonProgressGET } from "@/src/app/api/lesson-progress/route";

// Checkout
import { POST as checkoutPOST } from "@/src/app/api/checkout/route";

// Subscriptions
import { POST as subCancelPOST } from "@/src/app/api/subscriptions/cancel/route";
import { POST as subResumePOST } from "@/src/app/api/subscriptions/resume/route";
import { POST as subSchedulePOST } from "@/src/app/api/subscriptions/schedule/route";
import { POST as subScheduleCancelPOST } from "@/src/app/api/subscriptions/schedule/cancel/route";
import { GET as subInvoicesGET } from "@/src/app/api/subscriptions/invoices/route";

// Attendance
import { GET as attendanceGET, POST as attendancePOST, DELETE as attendanceDELETE } from "@/src/app/api/attendance/route";

// ── Test setup ────────────────────────────────────────────────────────────────

// v4-shape UUID with the version (13th char) and variant (17th char) bits
// set correctly. Required because Zod's .uuid() rejects nil-pattern UUIDs.
const FAKE_ID = "00000000-0000-4000-8000-000000000099";
const ALL_ROLES: Role[] = [1, 2, 3];

type AuthCase = {
  name: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  call: (cookies: string) => Promise<{ status: number }>;
  /** [] = any authed; otherwise the roles permitted. */
  allowed: Role[];
  /** True when the route has a public sub-flow (currently only /api/checkout). */
  publicSubFlow?: boolean;
};

// ── The matrix ────────────────────────────────────────────────────────────────

const AUTH_CASES: AuthCase[] = [
  // ─── Admin (role [3]) ──────────────────────────────────────────────────────
  { name: "GET /api/admin/assignments", call: (c) => call(assignmentsGET, { cookies: c }), allowed: [3] },
  { name: "POST /api/admin/assignments", call: (c) => call(assignmentsPOST, { method: "POST", cookies: c, body: { coachId: FAKE_ID, studentId: FAKE_ID } }), allowed: [3] },
  { name: "DELETE /api/admin/assignments/[id]", call: (c) => call(assignmentsDELETE, { method: "DELETE", cookies: c, params: { id: FAKE_ID } }), allowed: [3] },
  { name: "GET /api/admin/courses", call: (c) => call(coursesGET, { cookies: c }), allowed: [3] },
  { name: "POST /api/admin/courses", call: (c) => call(coursesPOST, { method: "POST", cookies: c, body: { course: { title: "Test" } } }), allowed: [3] },
  { name: "PUT /api/admin/courses/[id]", call: (c) => call(coursesPUT, { method: "PUT", cookies: c, params: { id: FAKE_ID }, body: { course: { title: "Updated" } } }), allowed: [3] },
  { name: "DELETE /api/admin/courses/[id]", call: (c) => call(coursesDELETE, { method: "DELETE", cookies: c, params: { id: FAKE_ID } }), allowed: [3] },
  { name: "GET /api/admin/courses/[id]/lessons", call: (c) => call(courseLessonsGET, { cookies: c, params: { id: FAKE_ID } }), allowed: [3] },
  { name: "POST /api/admin/courses/[id]/lessons", call: (c) => call(courseLessonsPOST, { method: "POST", cookies: c, params: { id: FAKE_ID }, body: { title: "L", slug: `l-${Date.now()}` } }), allowed: [3] },
  { name: "PUT /api/admin/courses/[id]/lessons/[lessonId]", call: (c) => call(lessonPUT, { method: "PUT", cookies: c, params: { id: FAKE_ID, lessonId: FAKE_ID }, body: { title: "U" } }), allowed: [3] },
  { name: "DELETE /api/admin/courses/[id]/lessons/[lessonId]", call: (c) => call(lessonDELETE, { method: "DELETE", cookies: c, params: { id: FAKE_ID, lessonId: FAKE_ID } }), allowed: [3] },
  { name: "POST /api/admin/courses/assign", call: (c) => call(courseAssignPOST, { method: "POST", cookies: c, body: { studentId: FAKE_ID, courseId: FAKE_ID } }), allowed: [3] },
  { name: "POST /api/admin/create-admin", call: (c) => call(createAdminPOST, { method: "POST", cookies: c, body: { email: `admin-${Date.now()}@t.com`, password: "Password123!", name: "Admin" } }), allowed: [3] },
  { name: "POST /api/admin/create-coach", call: (c) => call(createCoachPOST, { method: "POST", cookies: c, body: { email: `coach-${Date.now()}@t.com`, password: "Password123!", firstName: "C", lastName: "T" } }), allowed: [3] },
  { name: "GET /api/admin/employees", call: (c) => call(employeesGET, { cookies: c }), allowed: [3] },
  { name: "PUT /api/admin/employees/[id]", call: (c) => call(employeePUT, { method: "PUT", cookies: c, params: { id: FAKE_ID }, body: { employee: { first_name: "U", last_name: "C" } } }), allowed: [3] },
  { name: "GET /api/admin/employees/[id]/availability", call: (c) => call(employeeAvailGET, { cookies: c, params: { id: FAKE_ID } }), allowed: [3] },
  { name: "PUT /api/admin/employees/[id]/availability", call: (c) => call(employeeAvailPUT, { method: "PUT", cookies: c, params: { id: FAKE_ID }, body: { weekday: 1, start_time: "09:00", end_time: "17:00", timezone: "America/New_York" } }), allowed: [3] },
  { name: "GET /api/admin/payment-plans", call: (c) => call(plansGET, { cookies: c }), allowed: [3] },
  { name: "POST /api/admin/payment-plans", call: (c) => call(plansPOST, { method: "POST", cookies: c, body: { name: "P", classes: 8, cents: 9900, currency: "usd", renewal: "monthly", stripe_price_id: `price_${Date.now()}` } }), allowed: [3] },
  { name: "PATCH /api/admin/payment-plans/[id]", call: (c) => call(planPATCH, { method: "PATCH", cookies: c, params: { id: FAKE_ID }, body: { name: "U" } }), allowed: [3] },
  { name: "PATCH /api/admin/payment-plans/[id]/archive", call: (c) => call(planArchivePATCH, { method: "PATCH", cookies: c, params: { id: FAKE_ID } }), allowed: [3] },
  { name: "GET /api/admin/payment-plans/stripe-preview", call: (c) => call(stripePreviewGET, { cookies: c, query: { priceId: "price_test" } }), allowed: [3] },
  { name: "GET /api/admin/pending-bookings", call: (c) => call(pendingGET, { cookies: c }), allowed: [3] },
  { name: "PATCH /api/admin/pending-bookings/[id]", call: (c) => call(bookingPATCH, { method: "PATCH", cookies: c, params: { id: FAKE_ID }, body: { weekday: 1, start_time: "10:00", end_time: "11:00", timezone: "America/New_York" } }), allowed: [3] },
  { name: "POST /api/admin/pending-bookings/[id]/preview", call: (c) => call(bookingPreviewPOST, { method: "POST", cookies: c, params: { id: FAKE_ID }, body: { coach_id: FAKE_ID, weekday: 1, start_time: "10:00", end_time: "11:00", timezone: "America/New_York", num_sessions: 8, start_date: "2025-01-01" } }), allowed: [3] },
  { name: "POST /api/admin/pending-bookings/[id]/approve", call: (c) => call(bookingApprovePOST, { method: "POST", cookies: c, params: { id: FAKE_ID } }), allowed: [3] },
  { name: "GET /api/admin/students", call: (c) => call(studentsGET, { cookies: c }), allowed: [3] },
  { name: "PUT /api/admin/students/[id]", call: (c) => call(studentPUT, { method: "PUT", cookies: c, params: { id: FAKE_ID }, body: { student: { first_name: "U", last_name: "S" } } }), allowed: [3] },
  { name: "GET /api/admin/students/lessons/[studentId]", call: (c) => call(studentLessonsGET, { cookies: c, params: { studentId: FAKE_ID } }), allowed: [3] },

  // ─── Coach (role [2]) ──────────────────────────────────────────────────────
  { name: "GET /api/coach/conversation", call: (c) => call(coachConversationGET, { cookies: c, query: { contactId: FAKE_ID } }), allowed: [2] },
  { name: "GET /api/coach/courses", call: (c) => call(coachCoursesGET, { cookies: c }), allowed: [2] },
  { name: "POST /api/coach/courses/assign", call: (c) => call(coachCourseAssignPOST, { method: "POST", cookies: c, body: { studentId: FAKE_ID, courseId: FAKE_ID } }), allowed: [2] },
  { name: "GET /api/coach/conversation/message", call: (c) => call(coachConversationMsgGET, { cookies: c, query: { conversationId: FAKE_ID } }), allowed: [2] },
  { name: "PATCH /api/coach/lesson-feedback", call: (c) => call(coachFeedbackPATCH, { method: "PATCH", cookies: c, body: { student_id: FAKE_ID, lesson_id: FAKE_ID, positive_feedback: "<p>x</p>", improvement_feedback: "<p>y</p>" } }), allowed: [2] },
  { name: "PATCH /api/coach/lesson-progress", call: (c) => call(coachProgressPATCH, { method: "PATCH", cookies: c, body: { student_id: FAKE_ID, lesson_id: FAKE_ID, status: 2 } }), allowed: [2] },
  // lesson-tasks uses FormData (multipart) — request.ts only sends JSON; covered by per-route file with a FormData helper (Phase 3+).
  { name: "GET /api/coach/lessons", call: (c) => call(coachLessonsGET, { cookies: c, query: { studentId: FAKE_ID } }), allowed: [2] },
  { name: "GET /api/coach/lessonspace/[coachId]/[studentId]", call: (c) => call(coachLessonspaceGET, { cookies: c, params: { coachId: FAKE_ID, studentId: FAKE_ID } }), allowed: [2] },
  { name: "GET /api/coach/sessions", call: (c) => call(coachSessionsGET, { cookies: c }), allowed: [2] },
  { name: "PATCH /api/coach/sessions/[id]", call: (c) => call(coachSessionPATCH, { method: "PATCH", cookies: c, params: { id: FAKE_ID }, body: {} }), allowed: [2] },
  { name: "GET /api/coach/students", call: (c) => call(coachStudentsGET, { cookies: c }), allowed: [2] },
  { name: "GET /api/coach/students/lessons/[studentId]", call: (c) => call(coachStudentLessonsGET, { cookies: c, params: { studentId: FAKE_ID } }), allowed: [2] },
  { name: "GET /api/coach/students/[studentId]/parent", call: (c) => call(coachStudentParentGET, { cookies: c, params: { studentId: FAKE_ID } }), allowed: [2] },

  // ─── Parent (role [1]) ─────────────────────────────────────────────────────
  { name: "PATCH /api/parent/setup", call: (c) => call(parentSetupPATCH, { method: "PATCH", cookies: c, body: {} }), allowed: [1] },
  { name: "GET /api/parent/sessions", call: (c) => call(parentSessionsGET, { cookies: c }), allowed: [1] },
  { name: "GET /api/parent/students", call: (c) => call(parentStudentsGET, { cookies: c }), allowed: [1] },
  { name: "GET /api/parent/students/[studentId]", call: (c) => call(parentStudentGET, { cookies: c, params: { studentId: FAKE_ID } }), allowed: [1] },
  { name: "GET /api/parent/students/[studentId]/availability", call: (c) => call(parentStudentAvailGET, { cookies: c, params: { studentId: FAKE_ID } }), allowed: [1] },
  { name: "PUT /api/parent/students/[studentId]/availability", call: (c) => call(parentStudentAvailPUT, { method: "PUT", cookies: c, params: { studentId: FAKE_ID }, body: {} }), allowed: [1] },

  // ─── User / Profiles / Lesson-progress ─────────────────────────────────────
  { name: "GET /api/user/role", call: (c) => call(userRoleGET, { cookies: c }), allowed: [] },
  // /api/profiles/select was deleted in Phase 4.5 — its sole caller (parent-without-PIN
  // branch of /profiles page) now uses the `selectProfile` server action like every
  // other branch. Covered by tests/integration/actions/selectProfile.test.ts.
  { name: "GET /api/lesson-progress", call: (c) => call(lessonProgressGET, { cookies: c, query: { studentId: FAKE_ID } }), allowed: [1, 2, 3] },

  // ─── Checkout (publicSubFlow) ──────────────────────────────────────────────
  // studentId != "new" → authed branch, role [1]. Anon flows through the public branch, so 401 is not asserted here.
  { name: "POST /api/checkout", call: (c) => call(checkoutPOST, { method: "POST", cookies: c, body: { studentId: FAKE_ID, priceId: "price_test" } }), allowed: [1], publicSubFlow: true },

  // ─── Subscriptions (role [1]) ──────────────────────────────────────────────
  { name: "POST /api/subscriptions/cancel", call: (c) => call(subCancelPOST, { method: "POST", cookies: c, body: { studentId: FAKE_ID } }), allowed: [1] },
  { name: "POST /api/subscriptions/resume", call: (c) => call(subResumePOST, { method: "POST", cookies: c, body: { studentId: FAKE_ID } }), allowed: [1] },
  { name: "POST /api/subscriptions/schedule", call: (c) => call(subSchedulePOST, { method: "POST", cookies: c, body: { studentId: FAKE_ID, priceId: "price_test" } }), allowed: [1] },
  { name: "POST /api/subscriptions/schedule/cancel", call: (c) => call(subScheduleCancelPOST, { method: "POST", cookies: c, body: { studentId: FAKE_ID } }), allowed: [1] },
  { name: "GET /api/subscriptions/invoices", call: (c) => call(subInvoicesGET, { cookies: c }), allowed: [1] },

  // ─── Attendance (mixed) ────────────────────────────────────────────────────
  { name: "GET /api/attendance", call: (c) => call(attendanceGET, { cookies: c, query: { student_id: FAKE_ID } }), allowed: [] },
  { name: "POST /api/attendance", call: (c) => call(attendancePOST, { method: "POST", cookies: c, body: { student_id: FAKE_ID, session_date: "2025-01-01", status: "attended" } }), allowed: [2, 3] },
  { name: "DELETE /api/attendance", call: (c) => call(attendanceDELETE, { method: "DELETE", cookies: c, body: { student_id: FAKE_ID, session_date: "2025-01-01" } }), allowed: [2, 3] },
];

// ── Test runner ───────────────────────────────────────────────────────────────

beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterAll(() => server.close());
beforeEach(resetAll);

for (const c of AUTH_CASES) {
  describe(c.name, () => {
    if (!c.publicSubFlow) {
      it("rejects anonymous with 401", async () => {
        const res = await c.call(ANON.cookies);
        expect(res.status).toBe(401);
      });
    }

    for (const role of ALL_ROLES) {
      // Any-authed routes (allowed: []) only assert 401 for anon — no role rejection.
      if (c.allowed.length === 0) continue;
      if (c.allowed.includes(role)) continue;
      it(`rejects role=${role} with 403`, async () => {
        const res = await c.call(await cookiesFor(role));
        expect(res.status).toBe(403);
      });
    }

    for (const role of c.allowed.length === 0 ? ALL_ROLES : c.allowed) {
      it(`accepts role=${role} (passes role gate, not 401)`, async () => {
        // Only assert not-401: the matrix's job is to prove the role gate
        // fired. A 403 from the *ownership* layer (e.g. assertOwnsStudent on
        // a FAKE_ID) is contract-correct and tested per-route. Asserting
        // not-403 here would falsely flag routes that correctly reject the
        // FAKE_ID we pass — see docs/api-ownership.md.
        const res = await c.call(await cookiesFor(role));
        expect(res.status).not.toBe(401);
      });
    }
  });
}
