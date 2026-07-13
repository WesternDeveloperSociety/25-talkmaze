# Deep Audit — 2026-05-20

*Historical document (pre-July-2026 API refactor): route paths herein refer to the old audience-prefixed layout; see docs/api-contract.md "URL & naming convention" for the current structure.*

A six-angle deep-dive run on `dev` after the contract rewrite. Complements `docs/repo-quality-audit.md` (the original baseline) with findings that audit missed. Every item below is **net-new**; nothing here repeats the original audit's CRITICAL list.

Methodology: six parallel exploration agents covered security/auth, data integrity & races, frontend, performance, external integrations, and test quality. ~125 raw findings; deduped and triaged by realistic blast radius (not theoretical worst-case).

---

## Overall rating: **B / 7.0 out of 10**

Better than ~70% of small-team production Next.js codebases. Architecture and docs are genuinely above-average. The debt is *concentrated* — a handful of routes, one webhook, one schema migration, and a few god components. None of it is structural.

### Breakdown by dimension

| Dimension | Grade | Why |
|---|---|---|
| Architecture & layering | A− | ESLint-enforced rules, clear domain split, documented contract layer |
| Documentation | A | Unusually honest — audits, deferrals, rationale all written down |
| Security (auth/RBAC) | B− | Most CRITICALs fixed, but three real holes remain (see #1, #5, #6–8) |
| Data integrity | C+ | Missing partial unique index on `student_subscriptions`, non-atomic approval sequence, race-prone matchmaking writes |
| Performance | C+ | Multiple unflagged N+1s, middleware DB-per-request, eager heavy bundles |
| Type safety | B− | Strict mode on, 74 `any`s in legacy paths, schema-type drift hidden behind `as any` casts |
| Frontend quality | C+ | 4 god components, weak a11y, `alert()` pattern, eager Tiptap/FullCalendar/Chart.js bundles, fragile Realtime cleanup |
| Test coverage | C+ | Strong infrastructure; ~44% route coverage; auth-matrix gives false sense of breadth; admin surface largely untested |
| Observability | C− | 222 `console.*` calls, no logger, PII (full Stripe invoice JSON) in logs |
| External integrations | B− | Stripe is mostly solid; LessonSpace is the soft underbelly; no env validation at boot |

**Path to A−:** Fix the three CRITICALs (`sendMessage`, `coach/lessonspace`, LessonSpace webhook cluster), add the missing unique index, write the ~20 missing admin route tests, ship a centralized logger + env validator. 1-2 weeks of focused work, not a refactor.

---

## CRITICAL — fix before next deploy

### 1. `sendMessage` server action has no conversation-ownership check
**File:** `src/lib/messaging/actions/sendMessage.ts:25-34`
Anyone authenticated can insert a message into any `conversation_id` they can guess. The documented `assertCoachOwnsConversation` helper exists but this action doesn't call it. `tests/integration/actions/sendMessage.test.ts:184` has an `it.todo("conversation membership (AUDIT gap)")` that flags it — and the gap was left open.
**Impact:** Any user → any conversation. Coach<>parent threads can be spammed or hijacked.

### 2. No partial unique index on `student_subscriptions(student_id) WHERE status = 'active'`
**Files:** schema (`supabase/migrations/**`), plus `src/app/api/webhooks/stripe/route.ts:113-117` and `:413-419`.
The webhook does `.eq("status","active").order(...).limit(1).maybeSingle()` and trusts the result. Two `setup_intent.succeeded` / `invoice.paid` events for the same student can race — both see "no active sub," both insert, both succeed. Combined with the absent Stripe event-id dedupe, every webhook retry is a potential duplicator.
**Impact:** Double subscriptions, mis-targeted renewals, mis-targeted refunds. Quietly corrupts billing state.

### 3. `approvePendingBookedSlot` is non-atomic over three writes
**File:** `src/lib/scheduling/server/matchmaking.ts:465-493`
Sequence: bulk `insert(generatedSessions)` → `update(booked_slots.status="active")` → `ensureCoachStudentJunction()`. Each is a separate round trip. If write #2 or #3 fails after #1, the slot stays `pending` but sessions exist; a retry creates duplicate sessions because `sessions` has no unique constraint on `(coach_id, student_id, start_time)`.
**Impact:** Ghost sessions, duplicate sessions, "approval failed but it kind of half-worked" state.

### 4. Concurrent matchmaking can double-book a coach
**File:** `src/lib/scheduling/server/matchmaking.ts:383-466`
`hasActiveBookedSlotConflict()` runs at read time; the actual insert happens many lines later. Two admins approving overlapping pending slots in parallel both pass the conflict check before either insert lands. No `SELECT ... FOR UPDATE`, no constraint to catch it.
**Impact:** Coach scheduled into two sessions at the same wall-clock time. Manual cleanup.

### 5. `coach/lessonspace` route still has no auth
**File:** `src/app/api/coach/lessonspace/[coachId]/[studentId]/route.ts` + `tests/integration/api/coach/lessonspace.test.ts:18-21`
Docs claim this was fixed in the rewrite. The test file documents that the route still mints a teacher join URL for *any* `(coachId, studentId)` pair without verifying the caller. The auth-matrix test happens to pass because of how the matrix is structured, giving a false "covered" signal.
**Impact:** Any authed user can generate a teacher link for any student.

### 6. LessonSpace email template is XSS-vulnerable
**File:** `src/app/api/webhooks/lessonspace/components/email_template.tsx:49`
`{summary}` is rendered with `whiteSpace: "pre-line"`. Combined with #7 (no webhook signature), an attacker can stuff anything into the summary field and have it emailed to a real human inbox.
**Impact:** Phishing payload delivery via your own infrastructure.

### 7. LessonSpace webhook is unauthenticated + room ID enumerable
**File:** `src/app/api/webhooks/lessonspace/route.tsx:35-75`
- 400 vs 404 vs 200 split lets an attacker enumerate every valid `webhook_room_id`.
- Combined with #6, the missing signature isn't a "we should add HMAC eventually" — it's an active vector right now.

### 8. Hardcoded shared inbox is a current PII leak
**File:** `src/app/api/webhooks/lessonspace/route.tsx:95`
Every student's AI lesson summary today goes to `wdstalkmaze@gmail.com`. Docs treat this as "pending a one-line flip." It's actually a daily PII spill into a shared mailbox.

---

## HIGH — real bugs you'll hit in production

### 9. Checkout's `Promise.all` cancellation of incomplete subs is non-atomic
`src/app/api/checkout/route.ts:183-185` — If the second `stripe.subscriptions.cancel()` rejects, the first already succeeded. Client retries → orphaned incomplete subs accumulate.

### 10. `requireRole` and `middleware.ts` both use `.single()` on the account lookup
`src/lib/auth/server/requireRole.ts:34-45` and `src/middleware.ts:71-76`. If a user's `account` row is missing while their auth session is valid, every request crashes with an unhandled rejection instead of a clean 500.

### 11. `Promise.all` patterns silently drop information
`src/lib/scheduling/server/previewPendingBooking.ts:300-323` runs 5 independent queries via `Promise.all`. Any one transient failure rejects the whole preview. Use `Promise.allSettled` + render-with-partial-data.

### 12. Stripe webhook reads `subscription.items.data[0]` blindly
`src/app/api/webhooks/stripe/route.ts:273` — Hardcoded `[0]`. Adding any add-on/seat/usage item silently picks the wrong price.

### 13. No idempotency key on Stripe customer creation
`src/app/api/checkout/route.ts:142` — Double-submitted signup creates two Stripe customers. Combined with #9: a user can end up with two customers, each with their own active subscription.

### 14. Middleware does 2-3 DB queries on every request
`src/middleware.ts:65-148` — `auth.getUser()` + `account.role` lookup + (for students on `/student/**`) a subscription check. None cached. Move `role` into Supabase JWT claims; cache subscription check in JWT or short-TTL cookie.

### 15. N+1 in messaging is in two places, not the one the docs mention
`src/app/(protected)/(families)/message/[id]/page.tsx:207-249` AND `src/app/api/coach/conversation/message/route.ts:61-105`. Same pattern: `Promise.all(messages.map(async m => fetch sender profile))`. 50 messages → 51 queries.

### 16. Attendance POST/DELETE both do a select-then-update on `student_subscriptions`
`src/app/api/attendance/route.ts:179-206` and `:279-292`. Decrement/increment of `sessions_remaining` is read-then-write, no row lock. Concurrent attendance marks → lost decrement → student gets a free session.

### 17. Coach lessons route returns all lessons in the database
`src/app/api/coach/lessons/route.ts:41-52` — no `course_id` or `coach_id` filter. Information disclosure + perf cliff.

### 18. Heavy client bundles loaded eagerly
FullCalendar (`CoachCalendarClient.tsx`, `AdminCalendar.tsx`), react-pdf (`SlideshowViewerInner.tsx`), Chart.js (`SessionsRemainingDonutChart.tsx`), Tiptap — none are `dynamic()`-imported. ~700KB of JS shipped to clients who don't always need it.

### 19. Avatar upload path uses `Date.now()` → collision risk
`StudentSetupForm.tsx:187`, `ParentProfilePageClient.tsx:113`, `StudentProfilePageClient.tsx:95`. Two uploads within 1ms (double-click) overwrite each other. `CourseLessonPanel.tsx:214+` already uses `crypto.randomUUID()` — that's the right pattern, just inconsistently applied.

### 20. Supabase Realtime channel cleanup is fragile
`src/app/(protected)/(families)/message/[id]/_client.tsx:161-165` — `unsubscribe()` is guarded with `if (!newChannel) return`, but if subscribe is in-flight at unmount, the channel leaks.

### 21. `Date.now()` in fixture seeds without a time freezer
~12 test files use `Date.now()` for "unique" course/lesson names. Run two test workers concurrently on the same Postgres → collisions. CI hides this because of low concurrency.

---

## MED — real but lower blast

### 22. Massive test coverage gap masked by auth-matrix
14 admin routes have no test file at all. Auth-matrix only includes routes that already have tests, so adding a row gives the illusion of coverage. `admin/create-admin`, `admin/create-coach`, all `admin/payment-plans/**`, `admin/pending-bookings/**`, `coach/students`, `parent/sessions`, `user/role` — none tested. Real coverage of the API surface is closer to 44%, not what the test-count implies.

### 23. Stripe metadata password regression not asserted
`tests/integration/api/checkout/checkout.test.ts` has a comment warning about the historical password-in-metadata bug, but no assertion that the metadata doesn't contain `password`. Next refactor can silently reintroduce it.

### 24. Resend `from:` is still `onboarding@resend.dev`
`src/app/api/webhooks/lessonspace/route.tsx:120` — sandbox sender. No retry/backoff on `resend.emails.send()` failure → transient outage = lost lesson summaries.

### 25. No central env-var validation at startup
`process.env.STRIPE_SECRET_KEY!` and friends appear ~11 times. Missing env → runtime crash on first hit, not deploy-time. A 20-line `src/lib/env.ts` with Zod would catch this at boot.

### 26. PIN check on `selectProfile` uses non-constant-time `!==`
`src/lib/profiles/actions/selectProfile.ts:40-43`. For a 4-digit PIN the timing channel is impractical, but a one-line `timingSafeEqual` swap removes the smell.

### 27. `previewPendingBooking` filters in app code instead of DB
`src/lib/scheduling/server/previewPendingBooking.ts:358-378` — fetches active slots with `.or(coach_id.eq..., student_id.eq...)` then filters in JS. Wasted work AND surfaces irrelevant data to the admin.

### 28. Missing `error.tsx` boundaries
Only `loading.tsx` files exist in route groups. Any uncaught error → ugly default Next error page. Add `error.tsx` to `(families)`, `coach`, `admin` group roots.

### 29. Coach calendar `loadSessions` recreates on every render
`CoachCalendarClient.tsx:40-57` — downstream pass-through to FullCalendar triggers re-mounts more than necessary.

### 30. DOMPurify is called with default config
`src/components/common/rich-text/RichTextDisplay.tsx:23` — default config is OK for Tiptap output today, but if anyone changes Tiptap's StarterKit to allow `<a>` tags, the default config doesn't auto-tighten. Explicit `ALLOWED_TAGS` / `ALLOWED_ATTR` is the safer pattern.

### 31. Stripe API version pinned without fallback
`src/services/stripe/client.ts:4` — `apiVersion: "2026-02-25.clover"`. Good that it's pinned. No fallback or compatibility shim if the dashboard account version drifts. Some `expand:` paths in cancel/refund logic are version-sensitive.

### 32. Chart.js / recharts loaded on the payments page
Loaded eagerly into a route visitors hit before auth state exists — adds to TTI on the most conversion-sensitive page.

### 33. Stripe webhook logs the full invoice JSON
`src/app/api/webhooks/stripe/route.ts:330` — `console.log("Invoice: " + JSON.stringify(invoice))`. Full PII payload including payment method fingerprints. Compliance footgun if logs leave the app boundary.

### 34. ConversationMessageInput has no double-submit guard
`src/app/(protected)/(families)/message/_components/ConversationMessageInput.tsx` — Enter+Enter double-submits.

### 35. Stale availability columns can silently diverge
`coach_availabilities` and `student_availabilities` carry both `_new` and legacy columns; writers update both, but if either UPDATE fails the columns diverge with no detection. Half the readers fall back, half don't. The original audit notes the migration is unfinished; the *divergence detection gap* is new.

---

## What the docs are quietly wrong about

1. **"Every CRITICAL audit finding closed"** — `coach/lessonspace/[coachId]/[studentId]` is *still* unauthenticated, and the test file admits it.
2. **"Service role usage confined to webhooks"** — `matchmaking.ts` uses it too (`:24`, `:347`). Defensible since matchmaking runs from webhooks/admin, but the docs claim a stricter rule than the code follows.
3. **"LessonSpace webhook signature pending vendor HMAC"** — framed as blocked-on-external. It's actually blocking an active XSS + PII leak vector.
4. **"4 god components"** — true. What docs miss: cross-route private import from `coach/_components/StudentDetails.tsx` into `(families)/message/[id]/_client` means refactoring messaging will break coach in non-obvious ways.
5. **Test count implies coverage** — auth-matrix only covers routes that already have tests. ~14 admin routes are silently uncovered.

---

## Things the docs got right

- The contract for newer routes is genuinely solid; `subscriptions/cancel`, `subscriptions/schedule`, `checkout` (post-fix) are good worked examples.
- ESLint architectural rules are real and enforced.
- The auth helpers (`requireRole`, `assertOwns*`) are correctly implemented — the problem isn't the helpers, it's that not every route calls them.
- The contract test infrastructure for Stripe webhooks does real signature verification.

---

## Severity tally (net-new findings)

| Category | CRITICAL | HIGH | MED |
|---|---|---|---|
| Security (auth/ownership) | 4 | 2 | 3 |
| Data integrity / races | 3 | 4 | 1 |
| Integrations (Stripe/LS/Resend) | 2 | 3 | 4 |
| Performance / N+1 | 0 | 5 | 1 |
| Frontend correctness | 0 | 3 | 4 |
| Tests / observability | 0 | 1 | 3 |
| **Total NEW** | **9** | **18** | **16** |

---

## Top-3 things to fix this week

1. **#1 + #5 + #6–8 (security cluster)** — `sendMessage` ownership, `coach/lessonspace` route, LessonSpace webhook (signature + recipient + XSS surface). All one focused day each.
2. **#2 (partial unique index on `student_subscriptions`)** — single migration; closes the entire webhook-race class of bugs.
3. **#3 + #4 (matchmaking atomicity)** — wrap approval in an RPC. Already on the docs' deferral list but the failure mode is worse than the docs imply.
