/**
 * Integration tests for src/middleware.ts redirect logic.
 *
 * Middleware reads cookies directly from NextRequest (not next/headers), so
 * tests call the middleware function directly with a constructed NextRequest.
 *
 * Two layers under test:
 *   1. updateSession  — session refresh + auth-based redirects (/login ↔ /profiles)
 *   2. middleware     — RBAC routing by account.role + active-profile cookie gating
 *
 * Redirect responses:  status 307, Location header set
 * Pass-through:        status 200 (NextResponse.next())
 */
import { describe, it, expect, beforeAll } from "vitest";
import { NextRequest } from "next/server";
import {
  createAccount,
  createCoach,
  createStudent,
  createSubscription,
  createPlan,
} from "@tests/helpers/factories";
import { signSessionFor } from "@tests/helpers/auth";
import { middleware } from "@/src/middleware";

// ── Request builder ───────────────────────────────────────────────────────────

function makeReq(
  path: string,
  cookies?: string,
): NextRequest {
  const headers: Record<string, string> = {};
  if (cookies) headers["Cookie"] = cookies;
  return new NextRequest(new URL(`http://localhost:3000${path}`), { headers });
}

/** Append active_profile cookies to an existing session cookie string. */
function withProfile(
  sessionCookies: string,
  profileId: string,
  profileType: "student" | "parent",
): string {
  return `${sessionCookies}; active_profile_id=${profileId}; active_profile_type=${profileType}`;
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

let regularCookies: string;
let coachCookies: string;
let adminCookies: string;
let studentId: string;
let subscribedStudentId: string;

beforeAll(async () => {
  // Regular user (role=1)
  const regular = await createAccount({ role: 1 });
  regularCookies = await signSessionFor(regular);

  // Coach (role=2)
  const { account: coachAccount } = await createCoach();
  coachCookies = await signSessionFor(coachAccount);

  // Admin (role=3)
  const admin = await createAccount({ role: 3 });
  adminCookies = await signSessionFor(admin);

  // Student with NO active subscription (for subscription gate test)
  const familyAccount = await createAccount({ role: 1 });
  const student = await createStudent(familyAccount);
  studentId = student.id;

  // Student WITH an active subscription
  const familyAccount2 = await createAccount({ role: 1 });
  const subscribedStudent = await createStudent(familyAccount2);
  subscribedStudentId = subscribedStudent.id;
  const plan = await createPlan({ classes: 8 });
  await createSubscription(subscribedStudent, plan, { status: "active" });
});

// ── Layer 1: updateSession — auth-based redirects ─────────────────────────────

describe("unauthenticated access", () => {
  it("redirects to /login when accessing a protected route", async () => {
    const res = await middleware(makeReq("/student"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("allows access to /login without a session", async () => {
    const res = await middleware(makeReq("/login"));
    expect(res.status).not.toBe(307);
  });

  it("allows access to /signup without a session", async () => {
    const res = await middleware(makeReq("/signup"));
    expect(res.status).not.toBe(307);
  });

  it("allows the root / without a session", async () => {
    const res = await middleware(makeReq("/"));
    expect(res.status).not.toBe(307);
  });

  it("bypasses auth for /api/webhooks/stripe (signature-verified instead)", async () => {
    const res = await middleware(makeReq("/api/webhooks/stripe"));
    expect(res.headers.get("location") ?? "").not.toContain("/login");
  });

  it("bypasses auth for /api/webhooks/lessonspace", async () => {
    const res = await middleware(makeReq("/api/webhooks/lessonspace"));
    expect(res.headers.get("location") ?? "").not.toContain("/login");
  });
});

// ── Authenticated user on /login ─────────────────────────────────────────────
// updateSession already handles /login for all roles — redirects to /profiles,
// then RBAC bounces coaches → /coach and admins → /admin from there.

describe("authenticated user on /login", () => {
  it("redirects a logged-in regular user away from /login to /profiles", async () => {
    const res = await middleware(makeReq("/login", regularCookies));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/profiles");
  });

  it("redirects a logged-in coach away from /login to /profiles", async () => {
    const res = await middleware(makeReq("/login", coachCookies));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/profiles");
  });

  it("redirects a logged-in admin away from /login to /profiles", async () => {
    const res = await middleware(makeReq("/login", adminCookies));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/profiles");
  });
});

// ── Authenticated user on other public-only pages (NOT YET IMPLEMENTED) ──────
// /signup, /forgot-password, and / have no value for a logged-in user.
// Expected destination is role-specific: regular → /profiles, coach → /coach,
// admin → /admin. Currently all pass through without a redirect.

describe("authenticated user on /signup", () => {
  it("redirects a logged-in regular user away from /signup to /profiles", async () => {
    const res = await middleware(makeReq("/signup", regularCookies));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/profiles");
  });

  it("redirects a logged-in coach away from /signup to /coach", async () => {
    const res = await middleware(makeReq("/signup", coachCookies));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/coach");
  });

  it("redirects a logged-in admin away from /signup to /admin", async () => {
    const res = await middleware(makeReq("/signup", adminCookies));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/admin");
  });
});

describe("authenticated user on /forgot-password", () => {
  it("redirects a logged-in regular user away from /forgot-password to /profiles", async () => {
    const res = await middleware(makeReq("/forgot-password", regularCookies));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/profiles");
  });

  it("redirects a logged-in coach away from /forgot-password to /coach", async () => {
    const res = await middleware(makeReq("/forgot-password", coachCookies));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/coach");
  });

  it("redirects a logged-in admin away from /forgot-password to /admin", async () => {
    const res = await middleware(makeReq("/forgot-password", adminCookies));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/admin");
  });
});

describe("authenticated user on /", () => {
  it("redirects a logged-in regular user away from / to /profiles", async () => {
    const res = await middleware(makeReq("/", regularCookies));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/profiles");
  });

  it("redirects a logged-in coach away from / to /coach", async () => {
    const res = await middleware(makeReq("/", coachCookies));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/coach");
  });

  it("redirects a logged-in admin away from / to /admin", async () => {
    const res = await middleware(makeReq("/", adminCookies));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/admin");
  });
});

// ── Layer 2: RBAC routing by account.role ────────────────────────────────────

describe("coach (role=2) routing", () => {
  it("redirects coach from /profiles to /coach", async () => {
    const res = await middleware(makeReq("/profiles", coachCookies));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/coach");
  });

  it("allows coach to access /coach", async () => {
    const res = await middleware(makeReq("/coach", coachCookies));
    expect(res.status).not.toBe(307);
  });

  it("redirects coach away from /admin to /student", async () => {
    const res = await middleware(makeReq("/admin", coachCookies));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/student");
  });
});

describe("admin (role=3) routing", () => {
  it("redirects admin from /profiles to /admin", async () => {
    const res = await middleware(makeReq("/profiles", adminCookies));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/admin");
  });

  it("allows admin to access /admin", async () => {
    const res = await middleware(makeReq("/admin", adminCookies));
    expect(res.status).not.toBe(307);
  });

  it("redirects admin away from /coach to /student", async () => {
    const res = await middleware(makeReq("/coach", adminCookies));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/student");
  });
});

describe("regular user (role=1) RBAC", () => {
  it("redirects regular user away from /coach to /student", async () => {
    const cookies = withProfile(regularCookies, studentId, "student");
    const res = await middleware(makeReq("/coach", cookies));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/student");
  });

  it("redirects regular user away from /admin to /student", async () => {
    const cookies = withProfile(regularCookies, studentId, "student");
    const res = await middleware(makeReq("/admin", cookies));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/student");
  });
});

// ── Layer 2: active-profile cookie gating (regular users only) ────────────────

describe("profile cookie gating", () => {
  it("redirects to /profiles when no active_profile_id cookie is set", async () => {
    // Regular user with a valid session but no profile selected yet
    const res = await middleware(makeReq("/student", regularCookies));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/profiles");
  });

  it("allows /onboarding without an active profile (onboarding carve-out)", async () => {
    const res = await middleware(makeReq("/onboarding", regularCookies));
    // Should not redirect to /profiles even with no active_profile_id
    expect(res.headers.get("location") ?? "").not.toContain("/profiles");
  });

  it("allows /profiles itself without an active profile cookie", async () => {
    const res = await middleware(makeReq("/profiles", regularCookies));
    // Regular users hit /profiles to pick a profile — redirect goes to /coach or /admin
    // only for role 2/3. For role 1, it should pass through /profiles.
    expect(res.headers.get("location") ?? "").not.toContain("/profiles");
  });

  it("redirects student profile to /payments when no active subscription", async () => {
    const cookies = withProfile(regularCookies, studentId, "student");
    const res = await middleware(makeReq("/student", cookies));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/payments");
  });

  it("allows student with an active subscription to access /student", async () => {
    // The middleware checks student_subscriptions by student_id from the cookie,
    // not by session ownership — so any valid session + the subscribed student's
    // profile cookie should pass through.
    const cookies = withProfile(regularCookies, subscribedStudentId, "student");
    const res = await middleware(makeReq("/student", cookies));
    expect(res.headers.get("location") ?? "").not.toContain("/payments");
  });

  it("allows parent profile type to access /parent without subscription check", async () => {
    const cookies = withProfile(regularCookies, studentId, "parent");
    const res = await middleware(makeReq("/parent", cookies));
    // Parents bypass the subscription gate — should not redirect to /payments
    expect(res.headers.get("location") ?? "").not.toContain("/payments");
  });
});

// ── /reset-password accessibility ─────────────────────────────────────────────
// The Supabase reset flow: user clicks email link → /auth/confirm validates the
// token and creates a session → browser lands on /reset-password already authed.
// So /reset-password must stay reachable for authenticated users. It should also
// be reachable unauthenticated in case the session isn't established yet.
// BUG: updateSession does not whitelist /reset-password, so unauthenticated
// requests are redirected to /login. Regular users with no profile cookie are
// also redirected to /profiles by the profile gate.

describe("/reset-password accessibility", () => {
  it("allows unauthenticated access to /reset-password (token is the credential)", async () => {
    const res = await middleware(makeReq("/reset-password"));
    expect(res.headers.get("location") ?? "").not.toContain("/login");
  });

  it("allows authenticated regular user to access /reset-password (not blocked by profile gate)", async () => {
    const res = await middleware(makeReq("/reset-password", regularCookies));
    expect(res.headers.get("location") ?? "").not.toContain("/profiles");
  });

  it("allows authenticated coach to access /reset-password", async () => {
    const res = await middleware(makeReq("/reset-password", coachCookies));
    expect(res.status).not.toBe(307);
  });

  it("allows authenticated admin to access /reset-password", async () => {
    const res = await middleware(makeReq("/reset-password", adminCookies));
    expect(res.status).not.toBe(307);
  });
});

// ── /auth/confirm accessibility ───────────────────────────────────────────────
// The interstitial landed on by the recovery email link. It must be reachable:
//   - unauthenticated: the token in the URL is the credential; the page renders
//     a button and only verifies on POST (prefetch-safe).
//   - authenticated regular user with no profile cookie: an already-logged-in
//     user clicking a recovery link must still reach it (not bounced to
//     /profiles by the profile gate). Guards the `/auth` profile-gate carve-out.

describe("/auth/confirm accessibility", () => {
  it("allows unauthenticated access to /auth/confirm (token is the credential)", async () => {
    const res = await middleware(makeReq("/auth/confirm"));
    expect(res.headers.get("location") ?? "").not.toContain("/login");
  });

  it("allows authenticated regular user with no profile cookie to access /auth/confirm", async () => {
    const res = await middleware(makeReq("/auth/confirm", regularCookies));
    expect(res.headers.get("location") ?? "").not.toContain("/profiles");
  });

  it("allows authenticated coach to access /auth/confirm", async () => {
    const res = await middleware(makeReq("/auth/confirm", coachCookies));
    expect(res.status).not.toBe(307);
  });

  it("allows authenticated admin to access /auth/confirm", async () => {
    const res = await middleware(makeReq("/auth/confirm", adminCookies));
    expect(res.status).not.toBe(307);
  });
});

// ── /payments accessibility ────────────────────────────────────────────────────
// /payments is intentionally in (public)/ so students without a subscription can
// reach the paywall. The profile cookie gate must not block it.
// BUG: /payments is not in the profile-gate carve-out (only /profiles and
// /onboarding are excluded), so a regular user with no profile cookie gets
// redirected to /profiles instead of being allowed through to pay.

describe("/payments accessibility", () => {
  it("allows authenticated regular user without a profile cookie to reach /payments", async () => {
    // New users land here before they have an active_profile_id cookie
    const res = await middleware(makeReq("/payments", regularCookies));
    expect(res.headers.get("location") ?? "").not.toContain("/profiles");
  });

  it("allows authenticated regular user with a student profile to reach /payments", async () => {
    const cookies = withProfile(regularCookies, studentId, "student");
    const res = await middleware(makeReq("/payments", cookies));
    expect(res.headers.get("location") ?? "").not.toContain("/profiles");
  });

  it("allows coach to access /payments", async () => {
    const res = await middleware(makeReq("/payments", coachCookies));
    expect(res.status).not.toBe(307);
  });
});

// ── Cross-profile-type access ─────────────────────────────────────────────────
// Family users can switch between parent/student profiles, but the active
// profile type must match the route namespace currently being visited.

describe("cross-profile-type access", () => {
  it("redirects student profile type away from /parent to /student", async () => {
    const cookies = withProfile(regularCookies, studentId, "student");
    const res = await middleware(makeReq("/parent", cookies));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/student");
  });

  it("redirects student profile type away from nested /parent routes to /student", async () => {
    const cookies = withProfile(regularCookies, studentId, "student");
    const res = await middleware(makeReq("/parent/schedule", cookies));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/student");
  });

  it("redirects parent profile type away from /student to /parent", async () => {
    const cookies = withProfile(regularCookies, studentId, "parent");
    const res = await middleware(makeReq("/student", cookies));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/parent");
  });

  it("redirects parent profile type away from nested /student routes to /parent", async () => {
    const cookies = withProfile(regularCookies, studentId, "parent");
    const res = await middleware(makeReq("/student/profile", cookies));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/parent");
  });
});

// ── Coach and admin on /student ───────────────────────────────────────────────
// The middleware protects /coach (non-coaches → /student) and /admin (non-admins
// → /student) but /student itself has no role guard. Coaches and admins can
// reach it, which is intentional — admin may need to preview the student view.

describe("coach and admin on /student (unguarded by design)", () => {
  it("coach can access /student without being redirected", async () => {
    const res = await middleware(makeReq("/student", coachCookies));
    expect(res.status).not.toBe(307);
  });

  it("admin can access /student without being redirected", async () => {
    const res = await middleware(makeReq("/student", adminCookies));
    expect(res.status).not.toBe(307);
  });
});
