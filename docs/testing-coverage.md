# Testing Coverage

Current state of the test suite **as of 2026-05-20**, post-contract-rewrite. For the rewrite history see `docs/test-rewrite-runbook.md`. (Test-file locations below reflect the July-2026 resource-oriented API refactor — files under `tests/integration/api/` now mirror the resource-grouped route tree; the headline counts predate it.)

---

## Headline numbers

| Layer | Files | Tests | Passing | Failing | Todo |
|---|---|---|---|---|---|
| Unit | 7 | 99 | 99 | 0 | 0 |
| Integration + contract | 29 | 528 | 527 | 0 | 1 |
| **Total** | **36** | **627** | **626** | **0** | **1** |

CI is green on `testing-overhaul`. No intentional REDs remain — every audit-flagged gap is either fixed or has a `.todo` test with a tracked follow-up.

---

## Where things live

```
tests/
├── unit/                    # Pure-logic tests, no DB. ~10s. Run with npm run test:unit.
│   ├── auth/                # requireRole, ownership helpers
│   ├── payments/            # refund-window policy
│   ├── profiles/            # profile cookies
│   ├── scheduling/          # matchmaking algorithm (timezone, DST, conflicts)
│   └── utils/               # formatDateTime, formatName
├── integration/             # Real Supabase, real GoTrue. ~2-3 min. Run with npm run test:integration.
│   ├── actions/             # Server-action tests (selectProfile, sendMessage, getLessonSpace)
│   ├── api/                 # Per-route contract tests grouped by resource (mirrors src/app/api/**)
│   │   ├── _auth-matrix.test.ts   # Role gates for every route in src/app/api/**
│   │   ├── attendance/
│   │   ├── checkout/
│   │   ├── coaches/
│   │   ├── conversations/
│   │   ├── courses/
│   │   ├── sessions/
│   │   ├── students/        # incl. students/subscription/ (billing actions)
│   │   ├── subscriptions/   # invoices
│   │   └── *.test.ts        # single-file resources: lessons, lesson-tasks, lesson-progress(.patch/.feedback), lessonspace-rooms, parents-setup
│   ├── middleware/          # redirects.test.ts — covers updateSession + RBAC + profile gate
│   └── sanity/              # resetAll helper sanity
├── contract/
│   └── webhooks/            # Stripe + LessonSpace webhook contract tests
├── helpers/                 # Test infrastructure (auth, db reset, factories, side-effect assertions, Stripe mocks, request, MSW)
├── setup/                   # global-setup.ts (DB reset + .env load) + test-setup.ts + integration-mocks.ts
└── fixtures/                # Stripe + LessonSpace webhook fixture payloads
```

---

## The role-gate matrix

`tests/integration/api/_auth-matrix.test.ts` is a single parameterised file with one `AuthCase` per gated route in `src/app/api/**`. It asserts:
- `401` for anonymous on routes that don't have `publicSubFlow: true`.
- `403` for every role not in `allowed`.
- `not.toBe(401)` for every role in `allowed` (ownership-layer 403s are tested per-route).

Adding a new route = adding one row. Changing a route's role policy = one edit.

---

## Per-route 5-question test files

The 5-question template (`docs/test-rewrite-runbook.md` line 156) is the structure every per-route file follows:

```
Q1 — Who can call it?      (ownership; role gate is matrix territory)
Q2 — What inputs?          (Zod validation, malformed UUIDs, unknown fields)
Q3 — What does it return?  (response shape; no leaked internal columns)
Q4 — What does it persist? (DB side-effect assertions via expectRowExists / expectNoRow)
Q5 — What external calls?  (Stripe / LessonSpace / Resend args asserted with mocks/spies)
```

Coverage by resource (post-refactor layout; phase labels refer to the original rewrite):

| Resource | Files | Notes |
|---|---|---|
| `students/subscription` | 4 (cancel, resume, schedule.post, schedule.delete) | Phase 3 worked example; the canonical reference shape |
| `students` | 5 (one.get, availability, lessons.get, parent.get, sessions.get) | Phases 4.2–4.3 |
| `sessions` | 2 (list — role-dispatched GET, one.patch) | Phase 4.2 |
| `coaches` | 1 (sessions.get — admin coach calendar) | Post-rewrite addition (PR #112) |
| `conversations` | 2 (create, messages.get) | Phase 4.2 |
| `courses` | 3 (list — role-dispatched GET, students.post admin + coach legs) | Phases 4.2/4.4 |
| `attendance` | 1 (GET/POST/DELETE in one file — mixed-actor route) | Phase 4.3 |
| `checkout` | 1 | Phase 4.3; security regressions (no password to console / metadata / response) |
| `subscriptions` | 1 (invoices) | Post-rewrite addition (PR #110) |
| top-level files | 7 (lessons, lesson-tasks, lesson-progress, lesson-progress.patch, lesson-progress.feedback, lessonspace-rooms, parents-setup) | Phases 4.2–4.3 |

---

## Webhook contract tests

`tests/contract/webhooks/` (Phase 5). Three files, 19 tests:

| File | Coverage |
|---|---|
| `lessonspace.session-summary.test.ts` | Ownership-by-room, error shape, recipient pinned to interim hardcoded `wdstalkmaze@gmail.com` (route's `account.email` resolution is wired and ready for the one-line flip) |
| `stripe.invoice-paid.test.ts` | First-payment INSERT, renewal UPDATE, pending-plan clear, signature verification (missing + tampered) |
| `stripe.subscription-deleted.test.ts` | Cancellation, state-based idempotency, cross-student isolation |

Stripe SDK is mocked per-file with `vi.mock`; `webhooks.constructEvent` is kept REAL so signature verification actually runs against fixtures signed with `STRIPE_WEBHOOK_SECRET`.

---

## Test infrastructure (helpers)

`tests/helpers/`:

| Helper | Purpose |
|---|---|
| `db.ts` | `resetDb()`, `resetAuthUsers()`, `resetAll()` — TRUNCATE every public table + clear `auth.users` via GoTrue admin. Direct `pg` connection. Used by every new test file's `beforeEach`. |
| `auth.ts` | `signSessionFor(account)`, `cookiesFor(role)`, `ANON` constant. |
| `factories.ts` | `createAccount`, `createCoach`, `createStudent`, `createPlan`, `createSubscription`, `createSession`, `linkCoachToStudent`, etc. GoTrue-retry-aware. |
| `request.ts` | `call(handler, opts)` — invokes a route handler with constructed `NextRequest`. Supports JSON body, FormData (multipart), query, params, cookies. |
| `sideEffects.ts` | `expectRowExists`, `expectNoRow`, `getRow` — service-role observation of route side effects. |
| `stripeMocks.ts` | Fake-payload factories + per-call `.mockResolvedValueOnce` seeders. File-scope `vi.mock` per test file with `webhooks.constructEvent` kept real. |
| `stripe.ts` | `signWebhookFixture`, `signWebhookPayload` — Stripe.webhooks.generateTestHeaderString wrappers. |
| `subscriptionFixtures.ts` | `seedOwnerWithActiveSubscription`, `seedStranger`. |
| `msw.ts` | MSW handlers for LessonSpace and Resend (Stripe is module-mocked). |
| `nextHeadersMock.ts` | Shared cookie context for `next/headers`-via-mock. |

---

## CI

Workflow at `.github/workflows/test.yml`. Triggers on push and PR to `main`, `dev`, `testing`, `testing-overhaul`. Draft PRs skip the integration job.

**Unit job** (~10s):
1. `npm ci`
2. `npm run test:unit`

**Integration job** (~3-4 min):
1. `npm ci` (installs the Supabase CLI binary bundled in the npm package)
2. `npx supabase start` (Postgres 17 + GoTrue in Docker)
3. Parse `npx supabase status` → extract the publishable + service-role keys → write `.env.test`:
   - `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_SERVICE_ROLE_KEY` (per-run keys, not secrets)
   - `STRIPE_SECRET_KEY=sk_test_dummy`
   - `STRIPE_WEBHOOK_SECRET=whsec_test_talkmaze_integration` (the test helper signs payloads with this same value)
   - `LESSONSPACE_API_KEY=ls_test_dummy` (MSW intercepts; presence-only check)
   - `RESEND_API_KEY=re_test_dummy` (MSW intercepts; presence-only check)
4. `npm run test:integration`

`global-setup.ts` reads `.env.test` and falls back to `process.env`.

Concurrency: `cancel-in-progress: true` cancels stale queued runs.

---

## Local `.env.test`

Gitignored. Get the Supabase keys with `npx supabase status` after `supabase start`.

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<ANON_KEY from supabase status>
SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY from supabase status>
LESSONSPACE_API_KEY=ls_test_dummy
STRIPE_SECRET_KEY=sk_test_dummy
STRIPE_WEBHOOK_SECRET=whsec_test_dummy
RESEND_API_KEY=re_test_dummy
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_dummy
```

Note: vitest also loads `.env.local`. Don't rely on `.env.local` values for test correctness — CI doesn't have one. The two CI-introduced dummies (RESEND, LESSONSPACE) were added when an end-of-overhaul CI run surfaced env-presence checks the local `.env.local` had been silently providing.

---

## Test commands

```bash
npm run test:unit              # vitest run --config vitest.config.ts
npm run test:integration       # vitest run --config vitest.integration.config.ts
npm run test:unit -- --watch   # watch mode for unit tests
```

To run a single file (faster iteration):
```bash
npm run test:integration -- tests/integration/api/lesson-progress.patch.test.ts
```

---

## Infrastructure patterns worth knowing

**vitest pool config** (`vitest.integration.config.ts`):
```
pool: "forks"
fileParallelism: false
```
Files run sequentially in a single fork. Without this, parallel file execution would race on the shared local Supabase. (`forks.singleFork: true` was removed when vitest 4 stopped accepting it; `fileParallelism: false` is sufficient.)

**Stripe mocking — two patterns:**
- Routes using `@/src/services/stripe/client` → `vi.mock("@/src/services/stripe/client", () => ({ stripe: { ... } }))`. Keep `webhooks.constructEvent` REAL so signature verification still runs.
- Routes that `new Stripe(...)` inline (just `checkout` does this) → `vi.hoisted()` + `vi.mock("stripe", () => ({ default: function() { return instance; } }))`. Must use `function`, not arrow, for `new` to work.
- **MSW does NOT intercept Stripe.** The Stripe SDK uses native `fetch` in Node 18+ which MSW's `setupServer` doesn't fully intercept. MSW handles LessonSpace and Resend.

**`server-only` mock** — any route importing a lib file that imports `"server-only"` will throw under vitest unless mocked. Already in `tests/setup/integration-mocks.ts`:
```ts
vi.mock("server-only", () => ({}));
```

**GoTrue rate limiting** — `auth.admin.createUser()` can return `AuthRetryableFetchError: {}` under load. `createAccount()` in `factories.ts` retries 3× with 800ms backoff. If a test file is creating dozens of accounts in `beforeAll`, add a settle delay or run it standalone first.

**N+1 in test factories is intentional** — `tests/helpers/factories.ts` makes one round-trip per row. Acceptable: integration tests run ~30 accounts max per file; bulk insert would over-couple.

**`next/headers` mock** — cookies for route handlers go through `nextCookies.header` in `tests/setup/integration-mocks.ts`. The `call()` helper sets this. Don't try to import `next/headers` directly in tests.

---

## What's intentionally not covered

| Item | Why |
|---|---|
| Stripe webhook event-id dedupe | Deferred — state-based idempotency is in place; full event-id table is a future PR |
| LessonSpace webhook signature verification | Waiting on LessonSpace to publish HMAC scheme |
| LessonSpace email recipient flip from interim hardcoded to `account.email` | Product decision — flip is one-line when ready |
| Middleware redirect tests for routes that pre-date the contract rewrite | Covered; CI green |
| Playwright / browser E2E | Phase 7+ scope (not started) |

---

## Reference

- `docs/api-contract.md` — route shape, status codes, error format (THE spec)
- `docs/api-auth.md` — `requireRole`, role matrix per resource
- `docs/api-ownership.md` — `assertOwns*` helpers, 404-vs-403 rule
- `docs/test-rewrite-runbook.md` — phased plan + decision log (closed; preserved for the 5Q + matrix templates)
- `docs/repo-quality-audit.md` — audit findings (mostly resolved; residuals documented inline)
