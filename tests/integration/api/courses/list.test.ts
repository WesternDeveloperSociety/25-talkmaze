/**
 * Contract tests for GET /api/courses (coach leg).
 *
 * Lists the course catalog so a coach can pick one to assign to a linked
 * student. The catalog itself is not student-scoped — every coach sees all
 * courses; ownership is enforced at assignment time.
 *
 * Five questions:
 *   Q1 ownership — none at this route (catalog is shared); role gate only
 *   Q2 validation — no body/query
 *   Q3 response — { courses: [...] }
 *   Q4 side effects — none
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
import { createCoach } from "@tests/helpers/factories";
import { signSessionFor } from "@tests/helpers/auth";
import { resetAll } from "@tests/helpers/db";
import { call } from "@tests/helpers/request";
import { server } from "@tests/helpers/msw";

import { GET as coursesGET } from "@/src/app/api/courses/route";

beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterAll(() => server.close());
beforeEach(resetAll);

async function seedCoach() {
  const { account: coachAccount } = await createCoach();
  const cookies = await signSessionFor(coachAccount);
  return { cookies };
}

// Q3
describe("GET /api/courses — response shape (coach leg)", () => {
  it("returns { courses: [] } when the catalog is empty", async () => {
    const { cookies } = await seedCoach();
    const res = await call(coursesGET, { cookies });
    expect(res.status).toBe(200);
    const body = await res.json<{ courses: unknown[] }>();
    expect(Array.isArray(body.courses)).toBe(true);
    expect(body.courses).toEqual([]);
  });

  it("returns the catalog rows with id/title/description/created_at", async () => {
    const adminDb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    const title = `Course-${Date.now()}`;
    await adminDb.from("courses").insert({ title, description: "Hello" });

    const { cookies } = await seedCoach();
    const res = await call(coursesGET, { cookies });
    expect(res.status).toBe(200);
    const body = await res.json<{
      courses: Array<{
        id: string;
        title: string;
        description: string | null;
        created_at: string;
      }>;
    }>();
    expect(body.courses.length).toBeGreaterThanOrEqual(1);
    const match = body.courses.find((c) => c.title === title);
    expect(match).toBeDefined();
    expect(typeof match!.id).toBe("string");
    expect(match!.description).toBe("Hello");
    expect(typeof match!.created_at).toBe("string");
  });
});
