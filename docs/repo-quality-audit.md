# Code Quality Audit

*Historical document (pre-July-2026 API refactor): route paths herein refer to the old audience-prefixed layout; see docs/api-contract.md "URL & naming convention" for the current structure.*

Ground truth from the original read of `dev`. Severities: **CRITICAL** = security or data-loss risk; **HIGH** = bug or maintainability cliff; **MED** = inconsistency or correctness smell; **LOW** = cruft.

---

> **Status (2026-05-20): the contract rewrite is complete on `testing-overhaul`. Every CRITICAL item below is fixed and has a regression test.** See `docs/test-rewrite-runbook.md` for the commit chain (Phases 1–6 + finalisation sweeps). HIGH/MEDIUM items are partially addressed — response-shape and Zod validation drift is closed (Phase 4.6); `select("*")` and ownership cleanups landed in the per-route sweeps; god-component refactors are still pending.
>
> The body below is kept as the historical starting-state record. Read top-to-bottom as "what `dev` looked like *before* the rewrite." For the residual list see the heading below.
>
> **Outstanding (not addressed):**
> - Stripe webhook event-id dedupe — state-based idempotency in place; processed-events table is a future PR.
> - LessonSpace webhook signature verification — waiting on provider HMAC.
> - LessonSpace email recipient pinned to `wdstalkmaze@gmail.com` — product decision; `account.email` resolution wired in the route, flip is one line.
> - Delete-then-INSERT atomicity in `admin/employees/[id]/availability`, `admin/courses/assign`, `insertLessonIntoCourse` — RPC-shaped follow-up.
> - `coach_availabilities` / `student_availabilities` half-finished column migration (`_new` variants coexist with legacy columns).
> - God components: `CourseLessonPanel.tsx`, `ParentProfilePageClient.tsx`, `LessonDetailClient.tsx`, `StudentProfilePageClient.tsx`.
> - Pre-existing UI lint errors (~100, all in dashboard components).

## CRITICAL — fix before doing anything else in these files

### 1. `src/app/api/admin/create-admin/route.ts` — RBAC check commented out

The route fetches the caller's `account.role` but the `if (role !== 3) return 403` branch is commented out (around line 41). Any authenticated user can create another admin. Restore the check.

### 2. `src/app/api/parent/students/[studentId]/route.ts` — no auth

GET handler accepts `studentId` from the URL and returns the parent's `account_id` without calling `auth.getUser()` or verifying ownership. Any authenticated user (and possibly any unauthenticated request that gets past middleware) can enumerate student → parent mappings. Also returns `NextResponse.json({status: 404, message: ...})` without passing `{ status: 404 }` to `NextResponse.json`, so the HTTP status is 200 on errors.

### 3. `src/app/api/coach/lessonspace/[coachId]/[studentId]/route.ts` — no auth

Generates and persists a LessonSpace teacher join URL for any `(coachId, studentId)` pair in the URL. No `auth.getUser()`, no role check, no verification that the caller is that coach. Anyone can mint a teacher link for any student.

### 4. `src/app/api/webhooks/lessonspace/route.tsx` — no signature verification

The handler accepts any POST and emails a lesson summary based on body content. There is no HMAC / shared-secret check. An attacker can:
- spoof summary content into the parent's email (Resend send at line ~69),
- enumerate students by `webhook_room_id`.

The recipient email is also hardcoded to `wdstalkmaze@gmail.com` (line ~69) instead of the resolved `emailData.email` — the comment above it acknowledges this is a dev placeholder still in main.

### 5. `src/app/api/checkout/route.ts` — plaintext password in Stripe metadata

The signup flow accepts a `password` field in the request body and stuffs it into the Stripe `Subscription.metadata` so the webhook can create the auth user later (line ~197). The password is also `console.log`'d (line ~25). Stripe metadata is visible in the dashboard, persisted, and indexed. Move account creation into the same request that has the password and remove the metadata field.

**Regression tests:** `tests/integration/api/checkout/checkout.test.ts` — "does not log the plaintext password to console" and "does not store the password in Stripe subscription metadata" are currently failing (bugs confirmed present); they turn green when the fix lands.

### 6. Admin routes with zero auth (use `createClient()` but never call `auth.getUser()`)

All of these should require `getCurrentUser()` + `account.role === 3`:

- `src/app/api/admin/assignments/route.ts` (GET, POST)
- `src/app/api/admin/assignments/[id]/route.ts` (DELETE)
- `src/app/api/admin/courses/route.ts` (GET, POST)
- `src/app/api/admin/courses/[id]/route.ts` (PUT, DELETE)
- `src/app/api/admin/courses/[id]/lessons/route.ts` (GET, POST)
- `src/app/api/admin/courses/[id]/lessons/[lessonId]/route.ts` (PUT, DELETE)
- `src/app/api/admin/courses/assign/route.ts` (GET, POST)
- `src/app/api/admin/employees/route.ts` (GET)
- `src/app/api/admin/employees/[id]/route.ts` (PUT)
- `src/app/api/admin/employees/[id]/availability/route.ts` (GET, PUT)
- `src/app/api/admin/payment-plans/route.ts` (GET, POST)
- `src/app/api/admin/payment-plans/[id]/route.ts` (PATCH)
- `src/app/api/admin/payment-plans/[id]/archive/route.ts` (PATCH)
- `src/app/api/admin/payment-plans/stripe-preview/route.ts` (GET)
- `src/app/api/admin/students/route.ts` (GET)
- `src/app/api/admin/students/[id]/route.ts` (PUT)
- `src/app/api/admin/students/lessons/[studentId]/route.ts` (GET)

The `pending-bookings` admin routes are worse: they use `createServiceRoleClient()` (RLS bypass) **and** lack auth:

- `src/app/api/admin/pending-bookings/route.ts` (GET)
- `src/app/api/admin/pending-bookings/[id]/route.ts` (PATCH)
- `src/app/api/admin/pending-bookings/[id]/approve/route.ts` (POST)
- `src/app/api/admin/pending-bookings/[id]/preview/route.ts` (POST)

Service-role is only legitimate in webhook handlers. Switch these to the authenticated client + admin role gate.

### 7. Coach routes that auth the user but don't verify caller↔student ownership

These accept `studentId` from query/body and act on it after only checking that the caller is logged in. A coach can mutate any student's record:

- `src/app/api/coach/lesson-feedback/route.ts` (PATCH)
- `src/app/api/coach/lesson-progress/route.ts` (PATCH)
- `src/app/api/coach/lesson-tasks/route.ts` (PATCH)
- `src/app/api/coach/lessons/route.ts` (GET, when `studentId` query param is provided)
- `src/app/api/coach/sessions/route.ts` (GET, when `student_id` filter is provided)
- `src/app/api/coach/conversation/route.ts` and `.../message/route.ts` — fetches conversation by `contactId`/`conversationId` without verifying it belongs to the calling coach.

The check is one query: `coach_students` must contain `(coach_id, student_id)`. This is now centralized as `assertCoachAssignedToStudent()` in `src/lib/auth/server/ownership.ts`.

---

## HIGH — performance & maintainability cliffs

### N+1 query patterns

- **`src/lib/scheduling/server/matchmaking.ts`** (lines ~69, 120, 200–249) — nested `for` loops iterate student slots × candidate start times × coaches, and each innermost iteration hits `booked_slots` and `sessions` again. In the worst case (5 slots × 10 starts × 20 coaches) that's ~10,000 queries per match. Pre-fetch every active `booked_slots` row and relevant `sessions` rows once, build an in-memory conflict map, then iterate.
- **`src/app/(protected)/(families)/message/[id]/page.tsx`** (lines ~207–249) — `getMessages()` fetches the message list, then `.map(async)` over each message to look up sender profile. 50 messages = 51 round-trips. Use Supabase relational select (`messages(*, students(...), parents(...))`) or batch the sender IDs.
- **`src/app/api/coach/conversation/message/route.ts`** (lines ~40–80) — same pattern; same fix.

### God components (> 400 lines)

| File | Lines | Notes |
|---|---|---|
| `src/app/(protected)/admin/courses/_components/CourseLessonPanel.tsx` | 1215 | 28 `useState` hooks; mixes form state, file uploads, drag-reorder, tasks. |
| `src/app/(protected)/(families)/parent/profile/_components/ParentProfilePageClient.tsx` | 767 | 26 `useState`; inline `LeftPanel`, `PersonalSection`, etc. components defined inside the component body. |
| `src/app/(protected)/coach/students/[studentId]/lessons/[lessonId]/LessonDetailClient.tsx` | 718 | 21 `useState`. |
| `src/app/(protected)/(families)/student/profile/_components/StudentProfilePageClient.tsx` | 633 | 20 `useState`; mirror of parent profile. |
| `src/app/(protected)/(families)/onboarding/_components/StudentSetupForm.tsx` | 609 | 11 `useState`; multi-step form. |
| `src/app/(protected)/coach/_components/StudentDetails.tsx` | 415 | 13 `useState`. Also commits a cross-route import (see below). |

The old audit's "admin/page.tsx is 1700 lines" claim is **out of date** — admin has been split. The new offender is `CourseLessonPanel.tsx`.

### Cross-route private-import violation

`src/app/(protected)/coach/_components/StudentDetails.tsx` imports `ConversationClient` from `@/src/app/(protected)/(families)/message/[id]/_client`. `_client.tsx` is route-private — coach should not reach into families. Promote `ConversationClient` to `src/components/` or `src/lib/messaging/`.

### Half-finished schema migration: duplicated availability columns

Both `coach_availabilities` and `student_availabilities` have **two pairs** of time columns:
- old: `start_time` / `end_time` (full ISO timestamps anchored to 1970-01-01)
- new: `start_time_new` / `end_time_new` (HH:mm:ss strings)

Current readers are inconsistent:

| Reader | Behaviour |
|---|---|
| `src/lib/scheduling/server/matchmaking.ts` | new only |
| `src/app/api/admin/pending-bookings/[id]/preview/route.ts` | `new ?? old` fallback |
| `src/app/(protected)/admin/coaches/page.tsx` | `new ?? old` fallback |
| `src/app/api/parent/students/[studentId]/availability/route.ts` | **old only** |
| `src/app/api/admin/employees/[id]/availability/route.ts` | **old only** |

Writers always populate both pairs. If the old columns are dropped before the parent/admin GETs are migrated, those endpoints break. Either finish the migration or drop the new columns.

### Stale `tw_id` / Teachworks cruft

- `src/app/api/admin/employees/[id]/availability/route.ts` lines 28, 33, 41, 68 — comments and error messages still say `tw_id`, but `resolveCoachUUID()` (lines 14–19) is a stub that returns the input unchanged. Either delete the function and inline the id, or rename and remove the stale comments.
- `src/services/supabase/types/database.ts` still has a `teach_works_url` column on `students` — drop next migration.

---

## MED — correctness & consistency

### Type safety

- **`as any` casts (15+ instances)** — concentrated in:
  - `src/app/api/coach/lesson-progress/route.ts` — five separate `(supabase.from("lesson_progress") as any)` casts. Indicates the generated types don't match the actual schema; either regen types or fix the query.
  - `src/app/api/coach/lesson-feedback/route.ts` line ~35 — same cast.
  - `src/app/api/coach/lessons/route.ts` line ~50 — `(progressRows as any[])`.
  - `src/app/api/webhooks/stripe/route.ts` lines ~242, 349 — `invoice as LegacyInvoice` / `invoiceAny`. Some of these bridge Stripe API-version drift; document or fix.
  - `src/app/(protected)/(families)/parent/lessons/[studentId]/page.tsx` — six `[] as any[]` fallback values in `Promise.resolve`. Type the fallbacks.

- **`: any` annotations (~25 instances)** spread across admin pages (`assignments/page.tsx`, `courses/page.tsx`, `students/page.tsx`, `coaches/page.tsx`), coach lesson pages, parent dashboard pages, and `SuccessClient.tsx`. Most are `(item: any)` in `.map()` callbacks — replace with the domain types from `src/lib/<domain>/types.ts`.

### Zod is installed but rarely used

Where Zod IS used (good examples to copy): `src/app/(public)/signup/page.tsx`, `(families)/onboarding/_components/StudentSetupForm.tsx`, `(families)/profiles/new-user-setup/page.tsx`, `(families)/profiles/add-student/page.tsx`.

Where it SHOULD be used: every API route body. Currently the API surface validates by manual `typeof` and regex checks (e.g. `pending-bookings/[id]/route.ts` PATCH). High-value targets: the two `availability` PUT routes (which take a nested `Record<string, slots[]>` shape with no schema), every `/api/admin/**` POST/PATCH/PUT, every `/api/coach/**` PATCH.

### Inconsistent error response shapes

Mixed in the same codebase:
- `{ error: "..." }` (most common, recommended).
- `{ message: "..." }` (e.g. `src/app/api/parent/students/[studentId]/route.ts`).
- `{ status: 404, message: "..." }` with the HTTP status **not** passed to `NextResponse.json` — so the actual response is 200 (`src/app/api/parent/students/[studentId]/route.ts` lines ~17, 23).
- `{ error: 500, message: "..." }` mixing a numeric status into the body (`src/app/api/admin/courses/assign/route.ts` line ~81).

Pick `{ error: string }` with HTTP status set via the second arg of `NextResponse.json` and apply consistently.

### SQL injection risk

`src/app/api/admin/courses/assign/route.ts` (~line 98) builds a `.not(...)` filter via string concatenation rather than parameter binding. Even though this route has no auth, the injection risk compounds the bug.

### Console-logging in production code

~21 `console.log` / `console.error` calls remain in client + API code. Notable hotspots:
- `src/app/(protected)/admin/courses/_components/CourseLessonPanel.tsx` — 7
- `src/app/api/webhooks/stripe/route.ts` — 12+ (some genuinely useful for webhook debugging — keep with a logger abstraction instead of leaving raw `console.log`)
- `src/app/api/admin/employees/[id]/availability/route.ts` — 3
- `src/app/api/checkout/route.ts` — ~5 (one of which logs the user's password)

### `alert()` for user-visible errors (14 instances)

- `CourseLessonPanel.tsx` — 5
- `CourseDetailModal.tsx` — 3
- `EmployeeDetailModal.tsx` — 2
- `admin/assignments/page.tsx` — 2
- `signup/page.tsx`, `admin/layout.tsx`, `PackageRenewalOptionsContainer.tsx` — 1 each

Replace with a toast/modal pattern.

### Misc auth/UX bugs

- `src/app/api/lesson-progress/route.ts` assumes the caller has exactly one student — silently picks the first one. Multi-child families get wrong data.
- `src/app/api/parent/setup/route.ts` is authenticated but doesn't verify the caller has the parent role.
- `src/app/api/coach/students/route.ts` and `parent/sessions/route.ts` similar — auth-only, no role check.

---

## LOW — cruft

### Accessibility

Modals lack `role="dialog"` / `aria-modal="true"` and most icon-only buttons lack `aria-label`. Modals checked (`Create*Modal.tsx`, `*DetailModal.tsx`, `EditStudentAvailabilityModal.tsx`, `PendingBookingDetail.tsx`, `CreateAdminModal.tsx`, `CreateCoachModal.tsx`, `CreateCourseModal.tsx`, `CreatePlanModal.tsx`, `CoachingSessionDetailModal.tsx`, `EmployeeDetailModal.tsx`): 0 of 10 use `role="dialog"`; only 3 have an Escape-key handler; only ~16 `aria-label`s exist across the entire codebase.

### Duplicated components

- `src/app/(protected)/(families)/student/_components/ReviewLesson.tsx` vs `UpNextLesson.tsx` — 44 lines each, only the label text, emoji, and a `h-[244px]` differ. Replace with a single `LessonCard` with variant props.

### Empty `catch` blocks

None found in the current code — older audit's claim is no longer accurate.

### Missing `react-hooks/exhaustive-deps` violations

None found in current code — older audit's claim is no longer accurate.

---

## Priority order

1. Add auth + role gate to the seventeen unprotected admin routes + four `pending-bookings` routes (Critical #6). Most are 5–10 line changes.
2. Restore the role check in `create-admin/route.ts` (Critical #1).
3. Add auth to `parent/students/[studentId]`, `coach/lessonspace/.../[studentId]` (Critical #2, #3).
4. Add signature verification to the LessonSpace webhook; fix the hardcoded recipient email (Critical #4).
5. Remove `password` from the checkout request body and Stripe metadata; move auth-user creation to be synchronous with the request (Critical #5).
6. Add caller↔student ownership checks across the coach routes (Critical #7).
7. Fix the matchmaking N+1 (HIGH) — biggest performance lever in the app.
8. Standardise on `{ error: string }` + `NextResponse.json(..., { status })` and write Zod schemas as you go.
9. Break up `CourseLessonPanel.tsx` and the two profile-page god components.
10. Finish or abandon the availability column migration; in the meantime, switch the two old-only readers to the fallback pattern.
