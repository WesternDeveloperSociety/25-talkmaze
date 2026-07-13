# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack

Next.js 16 (App Router) + React 19 + TypeScript (strict) + Tailwind v4 + Supabase (Postgres / Auth / Storage) + Stripe + LessonSpace (external video) + Resend (transactional email) + Tiptap (rich text). 260 TS/TSX files under `src/`. Package manager: npm.

**Path alias:** `@/*` resolves to the repo root (see `tsconfig.json`). Imports look like `@/src/lib/...` — note the explicit `src/`.

## Commands

```bash
npm run dev              # next dev (http://localhost:3000)
npm run build            # next build
npm run start            # next start
npm run lint             # eslint (custom layering rules enforced — see below)
npm run gen-types        # regenerate src/services/supabase/types/database.ts from project zfnmverkmybrasrwhjyg
npm run test:unit        # vitest unit tests (no DB needed, ~10s)
npm run test:integration # vitest integration tests (requires supabase start + .env.test, ~60s)
npm run test:coverage    # unit tests with v8 coverage report
```

No Prettier/formatter beyond ESLint. The Supabase project ID is hard-coded into the `gen-types` script. Integration tests require a local Supabase instance (`supabase start`) and a `.env.test` file — see `docs/testing-coverage.md`.

CI runs both test suites automatically on every push and PR via `.github/workflows/test.yml`. Unit tests run unconditionally; integration tests are skipped on draft PRs.

## Architecture — the load-bearing pieces

### Route groups under `src/app/`

- `(public)/` — `login`, `signup`, `forgot-password`, `reset-password`, `payments` (the paywall and checkout flow lives here intentionally because students can hit it before having an `active_profile_*` cookie).
- `(protected)/` split by audience:
  - `(families)/` — student/parent-facing: `lessons`, `message`, `onboarding`, `parent`, `profiles`, `reward`, `student`. Wrapped in `ActiveProfileProvider` and `PageTitleProvider`.
  - `admin/`, `coach/` — role-specific dashboards.
- `api/` — REST handlers grouped by resource, never by audience (`students/`, `coaches/`, `admins/`, `sessions/`, `courses/`, `lessons/`, `lesson-progress/`, `lesson-tasks/`, `conversations/`, `booked-slots/`, `assignments/`, `payment-plans/`, `subscriptions/`, `checkout/`, `attendance/`, `reschedule-requests/`, `lessonspace/`, `parents/`, `me/`, `webhooks/{stripe,lessonspace}`). Role gating lives inside each handler, not in the URL — see `docs/api-contract.md` ("URL & naming convention") and the role matrix in `docs/api-auth.md`. Client fetches never hard-code `/api/...` string literals: they build URLs from the central typed registry `src/lib/api/routes.ts` (`api.students.one(id)` + `apiFetch`).

Route collocation conventions (underscore-prefixed = route-private, not routed by Next): `_components/`, `_hooks/`, `_context/`, `_lib/`, `_types/`, plus `actions.ts` for route-scoped server actions, and Next's standard `loading.tsx` (always renders `<PageSpinner />`). Keep `_lib/` flat while small; split into `_lib/server/`, `_lib/utils/`, etc. once a route accumulates enough helpers for the distinction to clarify ownership. Full convention also in `README.md`.

### Auth + access control (`src/middleware.ts` is critical)

Two layers run on every request:

1. **`updateSession()`** (`src/lib/auth/server/middleware/updateSession.ts`) — refreshes the Supabase auth cookie via `getClaims()`, redirects logged-in users away from `/login` and logged-out users away from anything that isn't `/`, `/login`, `/signup`, or `/auth`. **Do not insert logic between `createServerClient` and `getClaims()`** — the comment in the file calls out random logouts as the failure mode.
2. **RBAC + profile gating** (in `middleware.ts` itself) using `account.role` numeric codes:
   - `1` = regular user (parent/student family), `2` = coach, `3` = admin.
   - Coaches/admins hitting `/profiles` get bounced to their own dashboard. Non-coaches hitting `/coach` and non-admins hitting `/admin` get bounced to `/student`.
   - Regular users must have **both** `active_profile_id` and `active_profile_type` cookies. Missing them → `/profiles`. An `active_profile_type === "student"` user without an `active` row in `student_subscriptions` → `/payments`.
3. **`/api/webhooks/stripe` and `/api/webhooks/lessonspace` bypass both layers** (signature-verified instead). When adding webhook routes, exempt them in both `updateSession` and `middleware.ts`.

The active-profile cookies (`active_profile_id`, `active_profile_type` ∈ {`"student"`, `"parent"`}) are httpOnly, `secure` only in production, `sameSite: lax`. They're set by `selectProfile` (`src/lib/profiles/actions/selectProfile.ts`), which validates parent `profile_access_pin` if one is set. Server reads via `getActiveProfile()`; clients read via `useActiveProfile()` from `ActiveProfileContext`.

### Three Supabase clients — pick the right one

In `src/services/supabase/`:

- **`client.ts`** — `createClient()` browser client (publishable key). Use in Client Components.
- **`server.ts`** — `createClient()` server client wired to Next cookies. Use in Server Components, Route Handlers, and Server Actions. Default choice on the server.
- **`service.ts`** — `createServiceRoleClient()` bypasses RLS. **Only legitimate use is in webhooks** (Stripe / LessonSpace handlers, where there's no user session). Several admin routes use it as a shortcut to skip auth — that's a bug, not a pattern (see `docs/repo-quality-audit.md`).

`Database` types come from `src/services/supabase/types/database.ts` (generated — do not hand-edit; run `npm run gen-types`). 25 tables; map in `docs/data-model.md`.

### Layering rules (enforced by ESLint — see `eslint.config.mjs`)

- Nothing under `src/**` may import from `@/src/app/api/**`. API route handlers are HTTP endpoints, not a shared module. Put shared logic in `src/lib/<domain>/` and import that from both the route and any UI that needs it. (The rule is one-directional: routes can freely import from `src/lib/**`.)
- `src/services/lessonspace/**` is a pure provider adapter: cannot import from `@/src/lib/**`, `@/src/services/supabase/**`, or `@supabase/*`, and an AST rule forbids calling `.from(...)` (no DB access). Same spirit applies to other adapters in `src/services/` — keep them HTTP/SDK only.

### `src/lib/<domain>/` layout

Domains: `auth`, `coach`, `lessons`, `lessonspace`, `messaging`, `payments`, `profiles`, `scheduling`. Each contains:

- `actions/` — named server actions (one export per file, file named after the action).
- `server/` — server-only helpers that aren't actions.
- `types.ts`, `schemas.ts` — per-domain types and Zod schemas (Zod is installed but currently used in only one schema file; expand its usage rather than reinventing validation).

Business workflows live here and call into `src/services/*`. Don't reverse the direction. Route-specific loaders/helpers should stay colocated in that route's `_lib/` until they are reused across route areas or APIs. `getCurrentUser()` in `src/lib/auth/server/` is `cache()`-wrapped, returns the raw Supabase `User` (not enriched), and is the standard auth entry point inside routes/actions.

### Domain flows (read these before touching the related code)

- **Signup → onboarding → payment → matchmaking** has a deliberate lazy chain: signup creates `account` + `parents` + a placeholder `students` row only; the Stripe `customer` is created lazily in `/api/checkout`; the LessonSpace room is provisioned only after `invoice.paid` fires. Sessions/coach assignment happen inside the Stripe webhook via `assignCoachToStudent()` (or from onboarding once `student_availabilities` are set and `sessions_remaining > 0`). Full flow in `docs/data-model.md` + `docs/payments-flow.md`.
- **Matchmaking** — `assignCoachToStudent()` shuffles the student's weekly slots, generates candidate 1-hour starts on 10-min boundaries, checks the coach's and student's `booked_slots.status = "active"` rows and the `sessions` table for conflicts, then writes a `booked_slots` row as `pending` with `num_sessions` + `start_date`. **Pending slots do not block matchmaking** — only `active` does. Admin approval (`approvePendingBookedSlot`) materialises individual `sessions` rows weekly (with a hard cap of `num_sessions * 3` weeks to bound the search), flips the slot to `active`, and idempotently inserts a `coach_students` link. DST is handled by re-anchoring wall-clock time per week in the slot's timezone, not by adding UTC weeks. Algorithm in `docs/matchmaking.md`.
- **Stripe subscriptions** support upgrade/downgrade via Stripe `SubscriptionSchedule` (`POST /api/students/[studentId]/subscription/schedule` + `setup_intent.succeeded` webhook). Two-phase schedule keeps the old plan until period end, then transitions; `pending_plan_id` + `pending_stripe_schedule_id` track it on `student_subscriptions`. Refund window is 28 days from `current_period_start` (hard-coded in `src/lib/payments/server/policies.ts`). `docs/payments-flow.md` has the full lifecycle.
- **LessonSpace** — student room is provisioned once with webhooks enabled (`students.webhook_room_id` is the join key). Subsequent launches just regenerate participant URLs without webhooks. Incoming webhooks at `/api/webhooks/lessonspace` look up the student by `webhook_room_id`. Layer map in `docs/lessonspace-runtime-flows.md`.

### Conventions

- **Validation:** Zod is mostly absent from API routes; when you touch a route, add a Zod schema for its body instead of duplicating manual `typeof` checks. Collocate route-only schemas; promote to `src/lib/<domain>/schemas.ts` once shared.
- **Date/time:** `src/utils/formatDateTime.ts` exposes `fmtUtcTime/Date` for UTC sources (DB ISO strings) and `fmtLocalTime/Date` for client display. Recurring availability is stored as `weekday` + `HH:mm:ss` + `timezone` (not UTC); reinterpret per-date when materialising.
- **Names:** `fullName(first, last, fallback)` in `src/utils/formatName.ts`. First-last order, no titles.
- **Rich text:** Tiptap with `StarterKit` (`bold`, `bullet`/`ordered` lists only — no headings/blockquotes/code). Storage is raw HTML; render via `RichTextDisplay` which runs DOMPurify. Both live in `src/components/common/rich-text/`. `immediatelyRender: false` is required for SSR.
- **UI styling:** Tailwind v4 CSS-only config (`@import "tailwindcss"` in `globals.css`). Colours use a two-tier token system — Tier-1 raw brand palette (`--talkmaze-*`) → Tier-2 semantic shadcn tokens (`--primary`, `--accent`, `--card`, …). Font is **Roboto** via `next/font` (the `next/image` allowlist in `next.config.ts` covers the Supabase storage host only).
- **Components/UI:** shadcn (Radix) primitives in `src/components/ui/` built with `cva` + `cn` (`@/src/utils/cn`). Architecture, variant rules (orthogonal axes), tokens, atomic-design placement, and the shadcn workflow are canonical in **`docs/component-architecture.md` — read it before adding a component, variant, or colour.**
- **Loading:** `loading.tsx` files return `<PageSpinner />`; no skeleton pattern.
- **Calendars:** FullCalendar (dayGrid + timeGrid + interaction) wrapped once in `src/components/common/calendar/ScheduleCalendar.tsx` (cva variants `variant: dark|light`, `toolbar: default|compact`; explicit `height` required — page layout owns sizing). Styles in `src/styles/calendar/` (structure vs per-theme color files). The wrapper forces remount with `key={`${initialView}-${initialDate}`}` to work around plugin state issues.
- **Icons:** Local SVGs barreled from `src/components/ui/icons/index.ts`. `lucide-react` is also available and used sparingly.

### API contract (read this before editing any route)

**The contract layer is canonical** — see `docs/api-contract.md`, `docs/api-auth.md`, `docs/api-ownership.md`. Every gated route in `src/app/api/**` follows the four-stage shape: `requireRole` → Zod `.strict()` → `assertOwns*` → execute. When editing or adding a route, mirror this shape; don't reinvent.

Helpers in `src/lib/auth/server/`:
- `requireRole(allowedRoles)` — returns `{ user, account, supabase } | NextResponse`. Pass `[]` for any-authed; pass `[3]` for admin-only; etc.
- `assertOwnsStudent`, `assertCoachAssignedToStudent`, `assertCoachOwnsConversation`, `assertCoachOwnsSession` — per-resource ownership. Always called AFTER role gate.
- `resolveStudentIdForBilling` — composed helper for subscription routes; defaults to `studentNotFound: 404` but override to `403` per `docs/api-ownership.md:166`.

Response shapes:
- List endpoints: wrap in a named collection (`{ students: [...] }`, never bare arrays).
- Entity endpoints: `{ student: {...} }` or `{ success: true }` for mutations with no return value.
- Errors: `{ error: string }` with proper HTTP status code. **Never** `{ status, message }` in the body. **Never** leak `err.message` from a catch — use a generic `"Internal server error"`.

Worked examples to mirror:
- `src/app/api/students/[studentId]/subscription/cancel/route.ts` — Phase-3 canonical four-stage example.
- `src/app/api/lesson-progress/route.ts` — thin handler delegating to `src/lib/lessons/server/awardProgress.ts`.

### Status (2026-05-20): contract rewrite complete

The 6-phase rewrite (`docs/test-rewrite-runbook.md`) closed every CRITICAL audit finding. 627 tests pass (99 unit + 528 integration/contract). Outstanding items below are tracked in `docs/repo-quality-audit.md`.

**Intentional deferrals**
- Stripe webhook lacks event-id dedupe — state-based idempotency in place; processed-events table is a future PR.
- LessonSpace webhook lacks signature verification — waiting on provider HMAC.
- LessonSpace email recipient hardcoded to `wdstalkmaze@gmail.com` — product decision; route resolves `account.email`; flip is a one-line change in the route + the contract test.

**Data integrity (needs Postgres RPC migrations to fix properly)**
- `coaches/[id]/availability` PUT does DELETE-then-INSERT without transaction. Partial INSERT failure → coach has zero availability. Same shape in `courses/[courseId]/students` (course assignment) and `src/lib/lessons/server/insertLessonIntoCourse.ts`. Canonical fix: a Postgres function called via `supabase.rpc(...)`.

**Pre-existing tech debt unrelated to the contract**
- Half-finished `coach_availabilities` / `student_availabilities` column migration: `start_time_new`/`end_time_new` coexist with legacy `start_time`/`end_time`.
- `students.teach_works_url` column unused — drop in next migration.
- Stale `tw_id` references in comments.
- God components: `CourseLessonPanel.tsx` (1215 lines), `ParentProfilePageClient.tsx` (767), `LessonDetailClient.tsx` (718), `StudentProfilePageClient.tsx` (633).
- Cross-route private import: `coach/_components/StudentDetails.tsx` imports from `(families)/message/[id]/_client`. Promote to `src/lib/messaging/` or `src/components/`.
- Modals missing `role="dialog"` / `aria-modal`; icon-only buttons missing `aria-label`.
- ~100 pre-existing UI lint errors (`react-hooks/set-state-in-effect`, `no-explicit-any`, etc.) — all in dashboard components, all pre-date the rewrite.

### When adding code

- **New API routes** → follow the four-stage shape. Add a per-route 5-question test file (`docs/test-rewrite-runbook.md` line 156).
- **New tests** → `beforeEach(resetAll)` from `tests/helpers/db.ts`. Side-effect assertions via `expectRowExists` / `expectNoRow` from `tests/helpers/sideEffects.ts`.
- **Domain logic** with significant code in a route handler → extract to `src/lib/<domain>/server/`. The route should be the auth/validate/authorize/delegate skeleton.
- **New gated routes** → add a row to `tests/integration/api/_auth-matrix.test.ts` for the role-gate matrix.

### Supporting docs

Canonical (read these before editing):
- `docs/api-contract.md` — route shape, status codes, error format. **THE spec.**
- `docs/api-auth.md` — `requireRole`, role matrix per resource.
- `docs/api-ownership.md` — `assertOwns*` helpers, 404-vs-403 rule.

Domain references:
- `docs/component-architecture.md` — UI component architecture: primitives, variant rules, two-tier tokens, atomic-design placement, shadcn workflow.
- `docs/data-model.md` — full table inventory and entity graph.
- `docs/payments-flow.md` — Stripe checkout → invoice → schedule lifecycle.
- `docs/matchmaking.md` — coach/student matching algorithm.
- `docs/lessonspace-runtime-flows.md` — LessonSpace integration map.

Current state + history:
- `docs/testing-coverage.md` — current test coverage, helpers, CI shape.
- `docs/test-rewrite-runbook.md` — multi-phase rewrite plan (done, kept for the 5Q template + decision log).
- `docs/repo-quality-audit.md` — original audit findings + tracked residuals.
- `README.md` — original route collocation conventions.
