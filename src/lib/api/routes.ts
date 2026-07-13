/**
 * Central registry of client-callable API route paths.
 *
 * Every `fetch` to `src/app/api/**` builds its URL here - never from an inline
 * string literal. One place to change a path, and TypeScript catches typos and
 * missing ids at the call site.
 *
 * Out of scope: webhook routes (server-to-server, never fetched by our client)
 * and the browser-Supabase / server-actions.
 */

type Id = string | number;

type QueryValue = string | number | boolean | undefined | null;

/**
 * Builds a query string from defined query parameters.
 *
 * @param params - Key/value pairs to serialize. `undefined` and `null` values
 *   are omitted.
 * @returns A leading-`?` query string, or an empty string when no values are
 *   present.
 */
function qs(params: Record<string, QueryValue>): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) sp.set(key, String(value));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export const api = {
  admins: {
    create: () => "/api/admins",
  },
  coaches: {
    list: () => "/api/coaches",
    create: () => "/api/coaches",
    update: (id: Id) => `/api/coaches/${id}`,
    availability: (id: Id) => `/api/coaches/${id}/availability`,
    sessions: (id: Id) => `/api/coaches/${id}/sessions`,
  },
  students: {
    list: () => "/api/students",
    one: (studentId: Id) => `/api/students/${studentId}`,
    lessons: (studentId: Id) => `/api/students/${studentId}/lessons`,
    sessions: (studentId: Id) => `/api/students/${studentId}/sessions`,
    availability: (studentId: Id) => `/api/students/${studentId}/availability`,
    parent: (studentId: Id) => `/api/students/${studentId}/parent`,
    activeCourse: (studentId: Id) => `/api/students/${studentId}/active-course`,
    subscription: {
      cancel: (studentId: Id) =>
        `/api/students/${studentId}/subscription/cancel`,
      resume: (studentId: Id) =>
        `/api/students/${studentId}/subscription/resume`,
      schedule: (studentId: Id) =>
        `/api/students/${studentId}/subscription/schedule`,
    },
  },
  subscriptions: {
    invoices: (params: { limit?: number; startingAfter?: string } = {}) =>
      `/api/subscriptions/invoices${qs(params)}`,
  },
  checkout: () => "/api/checkout",
  paymentPlans: {
    list: () => "/api/payment-plans",
    create: () => "/api/payment-plans",
    update: (id: Id) => `/api/payment-plans/${id}`,
    archive: (id: Id) => `/api/payment-plans/${id}/archive`,
    stripePreview: (params: { priceId: string }) =>
      `/api/payment-plans/stripe-preview${qs(params)}`,
  },
  sessions: {
    list: (params: { student_id?: string } = {}) =>
      `/api/sessions${qs(params)}`,
    update: (id: Id) => `/api/sessions/${id}`,
    rescheduleRequest: (id: Id) => `/api/sessions/${id}/reschedule-request`,
    rescheduleDecision: (id: Id, decision: "approve" | "decline") =>
      `/api/sessions/${id}/reschedule-request/${decision}`,
  },
  rescheduleRequests: {
    list: () => "/api/reschedule-requests",
  },
  conversations: {
    create: () => "/api/conversations",
    messages: (id: Id) => `/api/conversations/${id}/messages`,
  },
  courses: {
    list: (params: { student_id?: string } = {}) => `/api/courses${qs(params)}`,
    create: () => "/api/courses",
    one: (courseId: Id) => `/api/courses/${courseId}`,
    lessons: (courseId: Id) => `/api/courses/${courseId}/lessons`,
    lesson: (courseId: Id, lessonId: Id) =>
      `/api/courses/${courseId}/lessons/${lessonId}`,
    students: (courseId: Id, params: { assigned?: boolean } = {}) =>
      `/api/courses/${courseId}/students${qs(params)}`,
    student: (courseId: Id, studentId: Id) =>
      `/api/courses/${courseId}/students/${studentId}`,
  },
  lessons: {
    list: () => "/api/lessons",
  },
  lessonTasks: () => "/api/lesson-tasks",
  lessonProgress: {
    root: () => "/api/lesson-progress",
    feedback: () => "/api/lesson-progress/feedback",
  },
  bookedSlots: {
    list: (params: { status?: "pending" } = {}) =>
      `/api/booked-slots${qs(params)}`,
    update: (id: Id) => `/api/booked-slots/${id}`,
    approve: (id: Id) => `/api/booked-slots/${id}/approve`,
    preview: (id: Id) => `/api/booked-slots/${id}/preview`,
  },
  assignments: {
    list: () => "/api/assignments",
    create: () => "/api/assignments",
    // coach_students has no surrogate key; the [id] segment is `<coachId>_<studentId>`
    remove: (coachId: string, studentId: string) =>
      `/api/assignments/${coachId}_${studentId}`,
  },
  attendance: () => "/api/attendance",
  me: () => "/api/me",
  parents: {
    setup: () => "/api/parents/setup",
  },
  lessonspace: {
    room: (studentId: Id) => `/api/lessonspace/rooms/${studentId}`,
  },
} as const;

type ApiFetchOptions = Omit<RequestInit, "body"> & {
  /** JSON body - stringified with `Content-Type: application/json`. */
  json?: unknown;
  /** Raw body (e.g. `FormData` for multipart routes) - passed through untouched. */
  body?: BodyInit;
};

/**
 * Thin `fetch` wrapper for API routes. Returns the raw `Response` so call
 * sites keep their existing `res.ok` / `res.json()` handling.
 *
 * @param path - API route path built from `api`.
 * @param options - Fetch options, plus optional JSON convenience handling.
 * @param options.json - Value to JSON-stringify and send with
 *   `Content-Type: application/json`.
 * @param options.body - Raw body to pass through unchanged when `json` is not
 *   provided.
 * @returns The raw `Response` returned by `fetch`.
 */
export async function apiFetch(
  path: string,
  options: ApiFetchOptions = {},
): Promise<Response> {
  const { json, headers, body, ...rest } = options;
  return fetch(path, {
    ...rest,
    headers:
      json !== undefined
        ? { "Content-Type": "application/json", ...headers }
        : headers,
    body: json !== undefined ? JSON.stringify(json) : body,
  });
}
