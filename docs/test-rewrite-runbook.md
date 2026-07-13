# Test Rewrite Runbook

*Historical document (pre-July-2026 API refactor): route paths herein refer to the old audience-prefixed layout; see docs/api-contract.md "URL & naming convention" for the current structure.*

> **Status: closed (2026-05-20).** The rewrite is complete; see the "What's done" section at the bottom and `docs/testing-coverage.md` for the current state. This doc is preserved for the 5-question template (line ~156), the matrix template (line ~250), and the decision log (line ~318). The phased plan and "agent loop" sections are historical.

This was the operational document for migrating the integration test suite from "describes current behaviour" to "describes the API contract."

**Canonical specs the rewrite produced:**

1. `docs/api-contract.md` — the API contract (status codes, error shape, validation, response shape, ordering of stages).
2. `docs/api-auth.md` — the auth gates and `requireRole` helper.
3. `docs/api-ownership.md` — ownership rules and the per-route matrix.

**Current state:**

- `docs/testing-coverage.md` — what tests exist, how they're organised, CI shape.
- `docs/repo-quality-audit.md` — the underlying audit (mostly resolved; residuals tracked at top).

---

## The model in one sentence

**The test file is the spec. The route file is the implementation. The route's job is to satisfy the test, not the other way around.**

This inverts the current state. Today, when a route does X, the test asserts X. After this rewrite, the test asserts what the contract says X *should be*, and the route is fixed (or the test is updated as a deliberate contract decision — never as a "make red green" reflex).

---

## Phases (do them in order)

### Phase 0 — DONE: real DB isolation

`tests/helpers/db.ts` now exposes:

```ts
resetDb()          // TRUNCATE every public table, RESTART IDENTITY CASCADE
resetAuthUsers()   // clear auth.users via GoTrue admin API
resetAll()         // both
```

Uses `pg` directly. Requires local Supabase running on the default port (54322) or `SUPABASE_DB_URL` set.

**New test files must `beforeEach(resetAll)`.** Existing test files keep working until migrated — they rely on shared `beforeAll` fixtures that would be nuked by per-test reset.

### Phase 1 — Build the auth helpers (~1 day)

Two new files, ~100 lines total.

- **`src/lib/auth/server/requireRole.ts`** — the canonical role gate. Signature in `docs/api-auth.md#the-requirerole-helper`. Returns either `AuthContext` or a `NextResponse` (401/403). Used as line 1 of every protected route.

- **`src/lib/auth/server/ownership.ts`** — three exports:
  - `assertOwnsStudent(auth, studentId)`
  - `assertCoachAssignedToStudent(auth, studentId)`
  - `assertCoachOwnsConversation(auth, conversationId)`

  Signatures in `docs/api-ownership.md#the-helpers`. Each returns the resolved resource or a `NextResponse`.

Write unit tests for both files (`tests/unit/auth/`). They are pure-ish (only the DB lookup matters) and worth ~10 unit tests each.

**Stop after Phase 1 and confirm with the human:** "Helpers landed. Sample route to use first?" The human picks the domain.

### Phase 2 — Restructure existing tests (mechanical, no behaviour change)

The goal is to make existing tests findable before rewriting. **No content changes** in this phase — just file moves.

1. Split `tests/integration/api/admin/auth-extended.test.ts` into one file per route:
   - `tests/integration/api/admin/assignments.test.ts`
   - `tests/integration/api/admin/courses.test.ts`
   - `tests/integration/api/admin/courses/[id]/lessons.test.ts`
   - ...one file per `src/app/api/admin/*/route.ts`

2. Split `tests/integration/api/coach/ownership.test.ts` the same way.

3. Create `tests/integration/api/_auth-matrix.test.ts` — a single parameterised file that holds the role-gate assertions for every route. Move the role-only tests (401-for-anon, 403-for-wrong-role) from every file into this matrix. See the template at the end of this doc.

4. Delete `tests/integration/api/admin/auth.test.ts` once `_auth-matrix.test.ts` covers its assertions.

After Phase 2 the suite is the same size with the same green/red counts, but every route's tests are in one obvious place.

### Phase 3 — Rewrite one domain as the template

Pick **`subscriptions`**. It has the densest logic, the most existing test material to learn from, and four distinct routes that exercise auth, ownership, validation, side effects, and external calls.

For each of the four files (`cancel.test.ts`, `resume.test.ts`, `schedule.test.ts`, `schedule/cancel.test.ts`), write the contract-shaped test from the template in `docs/api-contract.md` + the 5-question template at the end of this doc.

Then run the **agent loop** (below) to fix each route against its new test.

When all four routes pass:
- Delete the old `tests/integration/api/subscriptions/subscriptions.test.ts`.
- The pattern is now the worked example.

### Phase 4 — Apply the template, route by route

One route per agent invocation. In priority order:

1. Routes the audit flagged as CRITICAL (auth missing, ownership missing). Each fix flips RED tests to GREEN.
2. Routes that mutate state (POST/PUT/PATCH/DELETE). Higher risk of silent breakage.
3. GET routes. Lower priority.

Stop and commit after each route. Don't batch.

### Phase 5 — Webhook contract tests

The three highest-value gaps (infrastructure already exists):

1. `tests/contract/webhooks/stripe.invoice-paid.test.ts` — first payment + renewal paths.
2. `tests/contract/webhooks/stripe.subscription-deleted.test.ts` — cancellation idempotency.
3. `tests/contract/webhooks/lessonspace.session-summary.test.ts` — assert email recipient is `account.email`, not the hardcoded `wdstalkmaze@gmail.com` (this is RED until the bug is fixed).

Use `tests/helpers/stripe.ts:signWebhookFixture()` and the fixtures in `tests/fixtures/stripe/`.

---

## The agent loop (one route at a time)

This is the iterative loop. Run the `contract-fix` agent (`.claude/agents/contract-fix.md`) per route. The loop, in detail:

```
1. AGENT READS:
   - tests/integration/api/<path>.test.ts   (the spec for this route)
   - src/app/api/<path>/route.ts            (the implementation)
   - docs/api-contract.md                   (the rules)
   - docs/api-auth.md                       (the auth gates)
   - docs/api-ownership.md                  (the ownership matrix)

2. AGENT RUNS:
   npm run test:integration -- tests/integration/api/<path>.test.ts

3. AGENT REPORTS:
   For each failing test, a one-line contract violation explanation.
   DOES NOT EDIT ANY FILES YET. Stops and waits for human input.

4. HUMAN CONFIRMS OR AMENDS:
   "Fix all of them" / "Skip #3, that test is wrong, I'll update it"

5. AGENT FIXES THE ROUTE:
   - Edits route.ts (and supporting src/lib/<domain>/ files if needed)
   - Reruns the test file after each meaningful change
   - Does NOT edit .test.ts unless human explicitly said to

6. AGENT REPORTS RESULT:
   Diff summary + green/red status. Stops. Next route is a separate invocation.
```

**Hard rules for the agent:**

- **Never edit `.test.ts` files unless the human said "update the test."** The test is the spec. If a test seems wrong, surface it as a question, don't silently change it.
- **Never run more than one route's tests at a time during the fix loop.** Cross-contamination from other routes' shared state would hide the real result.
- **Never go autonomous.** After each route, stop and wait. The interesting decisions (404 vs 403, response shape commitments, error-shape choices) are judgment calls that compound across routes — one bad call locks the rest of the codebase into the wrong answer.
- **Never disable a test to make it pass.** No `it.skip`, no `it.todo`. If the test can't be made green, explain why and stop.
- **Never bypass auth/ownership checks to make a test green.** If a test fails because of ownership, the fix is the ownership helper, not a workaround.

---

## The 5-question test template

Every new per-route test file follows this exact structure. Copy and fill in.

```ts
// tests/integration/api/<path>.test.ts
import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from "vitest";
import { resetAll } from "@tests/helpers/db";
import { call } from "@tests/helpers/request";
import { signSessionFor, ANON } from "@tests/helpers/auth";
import { server } from "@tests/helpers/msw";
import {
  expectRowExists,
  expectNoRow,
} from "@tests/helpers/sideEffects"; // helper from Phase 3

// Mock external SDKs as needed at the top of the file.
// import { POST } from "@/src/app/api/.../route";

beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterAll(() => server.close());
beforeEach(resetAll);

describe("POST /api/<route>", () => {
  // ── Q1: WHO CAN CALL IT? ────────────────────────────────────────────────
  // Role-level auth (401 anon, 403 wrong role) lives in _auth-matrix.test.ts.
  // This block covers OWNERSHIP: right role, wrong resource.
  describe("ownership", () => {
    it("403 when authenticated user does not own the resource", async () => {
      // ...seed two accounts, call with the wrong one
    });
  });

  // ── Q2: WHAT INPUTS DOES IT ACCEPT? ─────────────────────────────────────
  describe("input validation", () => {
    it("400 when a required field is missing", async () => { /* ... */ });
    it("400 when a UUID field is malformed", async () => { /* ... */ });
    it("400 when body contains unknown fields (strict mode)", async () => { /* ... */ });
    it("error body is { error: string }", async () => { /* ... */ });
  });

  // ── Q3: WHAT DOES IT RETURN ON SUCCESS? ─────────────────────────────────
  describe("response shape", () => {
    it("returns the documented response shape on success", async () => { /* ... */ });
    it("does not leak internal columns", async () => { /* ... */ });
  });

  // ── Q4: WHAT DOES IT PERSIST? ───────────────────────────────────────────
  describe("side effects", () => {
    it("creates/updates the expected row on success", async () => {
      // call
      await expectRowExists("table", { ...predicate });
    });

    it("does NOT write when caller is unauthorized", async () => {
      // call with foreign cookies
      await expectNoRow("table", { ...predicate });
    });
  });

  // ── Q5: WHAT EXTERNAL CALLS DID IT MAKE? ────────────────────────────────
  describe("external calls", () => {
    it("calls Stripe (or LessonSpace / Resend) with the correct args", async () => {
      // expect(stripe.X.create).toHaveBeenCalledWith(expect.objectContaining(...))
    });

    it("does NOT call external services when unauthorized", async () => {
      // expect(stripe.X.create).not.toHaveBeenCalled()
    });
  });
});
```

15–20 tests per file. Each `it` answers one question. The file reads top-to-bottom as the full contract for that endpoint.

### Helpers you can assume exist (build in Phase 3 if missing)

```ts
// tests/helpers/sideEffects.ts
expectRowExists(table, predicate)  // SELECT ... WHERE predicate; fails if 0 rows
expectNoRow(table, predicate)      // SELECT ... WHERE predicate; fails if >0 rows
getRow(table, predicate)           // returns the row or null
```

```ts
// tests/helpers/auth.ts (already exists)
signSessionFor(account)
ANON
cookiesFor(role)                   // shorthand: cookies for a fresh role-N account
```

---

## The auth matrix file template

```ts
// tests/integration/api/_auth-matrix.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { resetAll } from "@tests/helpers/db";
import { call } from "@tests/helpers/request";
import { ANON, cookiesFor } from "@tests/helpers/auth";
// import every route handler...

type Role = 1 | 2 | 3;

type AuthCase = {
  name: string;
  call: (cookies: string) => Promise<{ status: number }>;
  allowed: Role[];      // [] = any authenticated user
  publicSubFlow?: boolean; // true for routes like /api/checkout that have a public branch
};

const ROUTES: AuthCase[] = [
  {
    name: "GET /api/admin/students",
    call: (c) => call(studentsGET, { cookies: c }),
    allowed: [3],
  },
  {
    name: "PATCH /api/coach/lesson-feedback",
    call: (c) => call(feedbackPATCH, {
      method: "PATCH",
      cookies: c,
      body: { student_id: SAMPLE_STUDENT, lesson_id: SAMPLE_LESSON },
    }),
    allowed: [2],
  },
  // ...one row per gated route
];

beforeEach(resetAll);

for (const r of ROUTES) {
  describe(r.name, () => {
    if (!r.publicSubFlow) {
      it("rejects anonymous with 401", async () => {
        const res = await r.call(ANON.cookies);
        expect(res.status).toBe(401);
      });
    }

    for (const role of [1, 2, 3] as const) {
      if (r.allowed.includes(role)) continue;
      if (r.allowed.length === 0) continue; // [] means any-authed; skip role rejection
      it(`rejects role=${role} with 403`, async () => {
        const res = await r.call(await cookiesFor(role));
        expect(res.status).toBe(403);
      });
    }
  });
}
```

Adding a new route is one row. Changing the role policy for a route is one edit. The 85-test wallpaper from `auth-extended.test.ts` collapses to ~150 lines.

---

## Decision log

Decisions made during the rewrite that bind future work. Append to this list when an agent surfaces a judgment call and the human resolves it.

| Date | Decision | Reason |
|---|---|---|
| 2026-05-20 | Adopt single error shape `{ error: string, code?, details? }` repo-wide | Single client-side handler; current 4 shapes cause UI inconsistency. |
| 2026-05-20 | Auth-first ordering: 401 always wins over 400 | Avoids leaking field names to unauth callers via "priceId required" errors. |
| 2026-05-20 | `404` for "doesn't exist," `403` for "exists but not yours" | Honest semantics; documented exception for sequential IDs (none today). |
| 2026-05-20 | Zod `.strict()` on every body schema | Catches typos and privilege-escalation field smuggling. |
| 2026-05-20 | One test file per route file | Locality + agent ergonomics. |
| 2026-05-20 | Role-gate matrix lives in one parameterised file | DRY; new routes are one row. |
| 2026-05-20 | The test is the spec; agents cannot edit tests without explicit human ask | Prevents calcifying wrong contracts via reflex fixes. |
| 2026-05-20 | `_auth-matrix.test.ts` "accepts role X" asserts `not.toBe(401)` only, NOT `not.toBe(403)` (corrects api-auth.md:308–311) | A contract-correct route returns 403 from the ownership layer when given a FAKE_ID resource. Asserting not-403 would flag ~13 ownership-coupled routes (subscriptions, parent/students, coach/*) as permanently red even after their auth gate works. Ownership is per-route file territory. |

---

## What's done, what's next

- [x] Phase 0: `resetDb`/`resetAuthUsers`/`resetAll` in `tests/helpers/db.ts`. `pg` added to devDependencies.
- [x] Phase 1: build `requireRole` and ownership helpers.
- [x] Phase 2: split existing test files 1:1 with route files. `_auth-matrix.test.ts` covers role gates for every gated route; `coach/ownership.test.ts` split into 7 per-route files; `admin/auth*.test.ts` deleted. `fileParallelism: false` added to integration config.
- [x] Phase 3: rewrite `subscriptions` domain as the worked example. 4 per-route contract-shaped test files (cancel, resume, schedule, schedule/cancel); 4 routes brought into compliance via `contract-fix` agent loop (Zod `.strict()`, `requireRole([1])`, four-stage shape, 403 ownership via per-call `resolveStudentIdForBilling` override, tightened catch-all 500). New helpers: `tests/helpers/sideEffects.ts`, `tests/helpers/stripeMocks.ts`, `tests/helpers/subscriptionFixtures.ts`. Old monolithic `subscriptions/subscriptions.test.ts` deleted.
- [x] Phase 4: route-by-route sweep. **Matrix is 219/219 GREEN** — every gated route in `src/app/api/**` satisfies the role-gate spec.
  - 4.1: 22 admin routes brought under `requireRole([3])`.
  - 4.2: 7 coach routes (lesson-feedback, lesson-progress, lessons, conversation, conversation/message, lessonspace, sessions×2) with per-route 5Q tests and ownership helpers; `assertCoachOwnsSession` added. `lesson-tasks` deferred (FormData infra needed).
  - 4.3: 6 security-critical routes (checkout, attendance×3, parent/students, parent/availability×2, parent/setup, lesson-progress). Removed checkout password leak.
  - 4.4: 7 admin business-logic routes (courses/assign SQL-injection fix, 4 pending-bookings dropping service-role, payment-plans/stripe-preview, create-coach shape cleanup) + 3 catch-up routes (coach/students, parent/sessions, parent/students).
  - Spillover (resolved): `coach/lesson-tasks` — requireRole + ownership + Zod + service-role drop. Added FormData support to `tests/helpers/request.ts`.
  - Cleanup (4.5): deleted `/api/profiles/select` (sole caller migrated to `selectProfile` server action); `/api/user/role` swapped to `requireRole([])`.
  - Finalisation (4.6): admin Zod + response-shape sweep — 16 admin routes brought to compliance with strict Zod schemas, named-collection wrappers, `{ error: string }` body, no `console.log`.
  - Extraction (4.7): four inline-domain blocks moved to `src/lib/<domain>/server/` — `awardProgress`, `insertLessonIntoCourse`, `previewPendingBooking`, `getStudentLessonsByCourse`.
- [x] Phase 5: webhook contract tests. Three files (19 tests total, all green):
  - `tests/contract/webhooks/lessonspace.session-summary.test.ts` — error-shape standardised. Recipient is pinned to the interim hardcoded `wdstalkmaze@gmail.com` per product decision; the route already resolves `account.email` so the flip is a one-line change when ready.
  - `tests/contract/webhooks/stripe.invoice-paid.test.ts` — first-payment + renewal paths; signature verification.
  - `tests/contract/webhooks/stripe.subscription-deleted.test.ts` — cancellation + state-based idempotency. Last test documents the audit's "no event-id dedupe" gap; flagged as future work.
  - Outstanding: LessonSpace signature verification (deferred from audit; tracked in route comment).
- [x] Phase 6: type/lint/build cleanup after the contract rewrite. `npx tsc --noEmit` exits 0; `npm run build` succeeds; ~17 UI consumers updated to read the new wrapped response shapes (`{ students }`, `{ courses }`, `{ lessons }`, `{ employees }`, `{ assignments }`, `{ plans }`, `{ pending }`, `{ availability }`, `{ messages }`, `{ parent }`, `{ task }`). `tests/` excluded from project tsc (vitest configs already resolve `@tests`; Stripe-typed test helpers can't be fixed without editing test files). Pre-existing UI lint errors remain — they predate the rewrite and are tracked separately in `docs/repo-quality-audit.md`. See `PHASE6_STATUS.md` for the runtime smoke-test checklist.

**Rewrite complete (2026-05-20).** The contract layer is the spec; every gated route in `src/app/api/**` follows it. The test suite (627 tests across 36 files: 99 unit + 528 integration/contract) is GREEN. The remaining audit items are intentional deferrals (Stripe event-id dedupe, LessonSpace signature verification) and RPC-shaped data-integrity follow-ups (`admin/employees/[id]/availability` and similar delete-then-insert pairs). See `docs/repo-quality-audit.md` for the residual list.

When you (or an agent) extend the codebase, tick a new box here and append to the Decision log if anything was decided along the way.
