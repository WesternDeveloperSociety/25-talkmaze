# Scheduling System — Edge Cases & Production-Readiness Gaps

A deep-dive audit of the scheduling stack: `src/lib/scheduling/server/{matchmaking,availability,previewPendingBooking}.ts`, the Stripe webhook handler, the `booked-slots`, `sessions`, `students/[studentId]/availability`, `coaches/[id]/availability`, and `students/[studentId]/subscription/*` routes, plus the `student_availabilities`, `coach_availabilities`, `booked_slots`, `sessions`, `student_subscriptions`, and `session_attendance` tables.

The system works for the **happy path** — single fresh student signs up, admin approves, sessions are generated for the requested count, weekly classes run. Almost every deviation from that path has a gap. They are grouped by severity below.

---

## 1. Mutation gaps — there is no way to change things after approval

These are the gaps the user explicitly asked about. The matchmaker writes `booked_slots` and `sessions`, but almost nothing reads/edits them afterward.

### 1.1 No "cancel future lessons" flow
- `POST /api/students/[studentId]/subscription/cancel` updates Stripe + `student_subscriptions.status` and the `customer.subscription.deleted` webhook flips the DB row to `cancelled`. **Neither touches `booked_slots` or `sessions`**.
- Result: a cancelled student still has an `active` `booked_slots` row blocking the coach's calendar, and N future `sessions` rows still appear on the coach's dashboard. The coach will think they have a 3pm Tuesday student forever. The matchmaker will treat the slot as permanently held when trying to place new students.
- Refund path (`refund=true`) immediately cancels the Stripe sub but leaves the same orphaned rows. Future sessions persist for months past the refund.

### 1.2 No "change my recurring slot" flow
- `PATCH /api/booked-slots/[id]` only matches `status="pending"`. Once approved, there is no endpoint to edit the `booked_slots` row or regenerate the sessions.
- Result: if a student or coach needs a different recurring time, the only way is to (a) manually edit the DB row, (b) manually edit each future `sessions` row, or (c) re-trigger matchmaking — none of which has a UI or API.

### 1.3 No single-session reschedule with safety
- `PATCH /api/sessions/[id]` updates only `start_time`/`end_time`. It does **not**:
  - Check overlap against other sessions or active `booked_slots`.
  - Check the new time is within the coach's `coach_availabilities`.
  - Check the new time is within the student's `student_availabilities`.
  - Update `sessions.weekday` (so the row's stored weekday silently desyncs from the UTC start).
- Parents/students have no reschedule endpoint at all.

### 1.4 No single-session cancel that does anything useful
- Parents can mark `session_attendance.status = "cancelled"` via `/api/attendance`, but:
  - The `sessions` row is not deleted.
  - `sessions_remaining` is not refunded (only `attended`/`missed` consume; `cancelled` is a no-op).
  - The slot is not freed — the coach calendar still shows the session.
  - There is no make-up / credit / rescheduling flow.
- There is no DELETE on `sessions`. Coaches cannot remove a one-off; admins cannot either.

### 1.5 No coach blackout / vacation / one-off unavailability
- `coach_availabilities` is purely weekly recurring. There is no `coach_unavailability` or `coach_blackouts` table.
- Holiday handling is impossible without manual per-session edits. Christmas Day class is scheduled like any other Wednesday.

### 1.6 Coach availability change does not cascade
- `PUT /api/coaches/[id]/availability` blows away the coach's availability rows and reinserts. Any active `booked_slots` or future `sessions` that no longer fall inside the new availability are not touched, not flagged, not surfaced. The matchmaker will read the new availability the next time it runs, but the orphaned bookings stay.
- The PUT is DELETE-then-INSERT and **not transactional** (acknowledged in CLAUDE.md): a partial failure leaves the coach with zero availability and no easy way to recover.

### 1.7 Student availability change has the same problem
- `PUT /api/students/[studentId]/availability` is identical in shape. Same non-transactional risk, same lack of conflict-detection against existing bookings. A parent can change to a time-window that has zero overlap with their current `booked_slots`, and nothing breaks until next renewal.

### 1.8 No coach reassignment flow
- If a coach quits, takes a leave of absence, or is fired, there is no endpoint to migrate a student to a new coach. The `coach_students` junction is only inserted in `approvePendingBookedSlot` and is never updated.

### 1.9 Pending bookings never expire
- A pending booking sits in `booked_slots` indefinitely if the admin doesn't approve it. Meanwhile Stripe continues renewing monthly (see §2.1), the parent thinks they bought lessons, and nothing on the coach side reflects the booking.

---

## 2. Renewal & subscription lifecycle

### 2.1 Renewal does not produce next month's sessions
- `invoice.paid` for a renewal runs `assignCoachToStudent(studentId, plan.classes)`. But the student already has an `active` `booked_slots` row. The matchmaker either:
  - Finds a free time for a *second* pending row (a duplicate recurring slot the admin must reject manually), or
  - Returns `success:false` if every candidate time overlaps the existing active slot.
- **In neither case does the renewal insert any new `sessions` rows.** The sessions for next month are never generated. The student's coach sees nothing on their calendar past whatever `approvePendingBookedSlot` originally generated.
- This is silent: the Stripe webhook returns 200 either way and nothing alerts an admin.

### 2.2 `sessions_remaining` is decoupled from `sessions`
- On renewal the DB resets `sessions_remaining` to `plan.classes` regardless of how many sessions actually got generated or attended.
- `session_attendance` decrements `sessions_remaining` only on `attended`/`missed` status. A class with no attendance record does not decrement. A `cancelled` does not decrement. A `wasConsuming → !wasConsuming` transition refunds.
- There is no invariant: `count(sessions where status=upcoming) + attended/missed_this_cycle == plan.classes`. The counter and the calendar drift.

### 2.3 No idempotency on Stripe webhooks (acknowledged)
- CLAUDE.md notes this is deferred. State-based idempotency is the only protection. With the renewal logic above, a retried `invoice.paid` will call `assignCoachToStudent` twice, potentially creating two pending bookings for the same student.

### 2.4 Initial matchmaker failure has no recovery path
- `assignCoachToStudent` returns 200 with `success:false` when no coach has a free slot. The webhook ignores the result. There is no admin alert, no email to the parent, no retry, no surface in the admin dashboard.
- Parent has paid, gets no confirmation, and nobody is notified. The only way to detect this is to manually scan `student_subscriptions` rows that have no corresponding `booked_slots`.

### 2.5 Cancelled subscription doesn't free coach calendar (see §1.1)

### 2.6 Subscription `pending_plan_id` / `pending_stripe_schedule_id` interactions with matchmaking
- An upgrade scheduled for next period activates via `invoice_payment.paid`, which then calls `assignCoachToStudent` with the new plan's `classes`. Same renewal problem as §2.1 — second pending booking, no actual session generation.
- The new plan may have more classes than the existing booked slot's `num_sessions`. There is no logic to extend the slot or generate the additional sessions.

---

## 3. Matchmaking algorithm — correctness

### 3.1 Non-uniform shuffle
`studentSlots.sort(() => 0.5 - Math.random())` and `coaches.sort(() => 0.5 - Math.random())` is not a uniform shuffle and mutates the original array. The coaches array is reshuffled on every candidate time inside the inner loop — wasteful and undermines the "round-robin" claim. Should be Fisher-Yates on a copy.

### 3.2 Only the first occurrence is validated for the coach
- The anchor search finds one date+time that works "this week". It does not verify any future occurrence is conflict-free.
- `approvePendingBookedSlot` then iterates `num_sessions * 3` weeks looking for clean weeks. If subsequent weeks conflict, approval fails with 409 and the slot stays pending. Parent has paid; admin must manually edit. There is no flow to surface "the matchmaker found you a time but the next 4 weeks all conflict — pick another time."

### 3.3 DST narrow miss in the anchor search
- The student's slot is interpreted in their tz on the **first matching weekday from tomorrow**. If that first week is in EST but the very next is in EDT, the matchmaker validates the EST candidate. After DST shifts, the recurring time in UTC shifts by an hour. The approval loop re-anchors per week (correct), but the matchmaker step's "coach is free" verdict was for an EST-aligned UTC time, which doesn't apply to subsequent EDT weeks. A coach's competing booking that exists in the EDT-aligned hour is missed.
- Mitigated only because `approvePendingBookedSlot` re-checks conflicts week-by-week, but that surfaces as a 409 at approval time rather than at match time.

### 3.4 `dayjs.day()` setter semantics
`bsDateLocal = candidateStartUTC.tz(bs.timezone).day(bs.weekday)` uses dayjs's `.day(n)` which moves within the same Sunday-Saturday week. If the candidate's weekday is later in the week than `bs.weekday`, the resulting date is *earlier* in the week, possibly with a different UTC offset across a DST seam. The downstream `bsStartLocal.utc()` comparison is then comparing the candidate's UTC range to a week-prior reconstruction. Fragile and unintuitive — should explicitly find the next occurrence of `bs.weekday` ≥ the candidate's local date.

### 3.5 `dayjs(anchorDateStr).add(weekOffset, "week").format("YYYY-MM-DD")` in `approvePendingBookedSlot`
- `dayjs(string)` parses in the **machine's local timezone**, not UTC or the slot's tz. Around midnight in some server tz, you can get a YYYY-MM-DD that's one day off. Should be `dayjs.tz(anchorDateStr, typedSlot.timezone)` or `dayjs.utc(anchorDateStr)`.

### 3.6 Half-finished `start_time_new`/`end_time_new` migration
- `coach_availabilities.start_time` is a 1970-anchored ISO timestamp (from `toTimestamp`). `coach_availabilities.start_time_new` is `HH:mm:ss`. The matchmaker reads `_new`; the preview falls back to either.
- `booked_slots.start_time` ends up storing **`HH:mm:ss`** because matchmaking inserts `matchingSlot.start_time_new` into the `start_time` column. So the same field name has different shapes in different tables. Anything that joins or compares them is broken.

### 3.7 No coach capacity limit
A single coach can be matched to unbounded students. No "max students per week" / "max hours per week".

### 3.8 No active/inactive flag on coaches
A deactivated coach (paused, on leave, terminated) is still eligible if their `coach_availabilities` rows exist. Removing availability is the only way to take them out, which loses the data.

### 3.9 Search horizon
- `searchStartDate = dayjs.utc().add(1, "day")`. Always "tomorrow". A user signing up on Sunday at 11pm for a Monday slot gets next-day class. There is no way for the student to pick a start date.
- The user cannot delay onboarding ("I want to start in 2 weeks").

### 3.10 No deduplication / locking
- Two concurrent webhook invocations (or two students signed up at the same instant who are both eligible for the same coach's only free slot) can both pass the conflict check, both insert pending bookings, both get approved by an admin. There is no DB-level uniqueness constraint preventing two `active` `booked_slots` on the same (coach, weekday, start_time, end_time, timezone) overlap.

### 3.11 Service-role client used everywhere in matchmaking
`assignCoachToStudent` and `approvePendingBookedSlot` use the service role. Justified for the webhook path; approval is wrapped behind `requireRole([3])` so OK. But there is no row-level audit trail of who approved or modified what.

---

## 4. Approval path — `approvePendingBookedSlot`

### 4.1 Two approvals can race
The pending fetch uses `.eq("status", "pending")`. Inserts sessions. Then updates status with `.eq("status", "pending")`. Two simultaneous approve clicks can:
1. Both pass the initial fetch.
2. Both insert `num_sessions` worth of rows → 2× sessions in the DB.
3. The first `update` succeeds, the second's `.eq("status","pending")` finds zero rows but the function still returns success (the activate-error branch only triggers on a real error).
Result: duplicate sessions, slot eventually activated. Fix: do an atomic `update().eq("status","pending").select()` first, then only insert sessions if exactly one row was claimed.

### 4.2 Bulk session insert isn't transactional with slot activation
If the sessions insert succeeds but the slot activation fails, the function returns 500 with sessions already created and the slot still pending. The next approval attempt will insert another N sessions.

### 4.3 `coach_students` junction insert errors are swallowed
`ensureCoachStudentJunction` logs the error but doesn't propagate it. A coach approved for a student may end up with no `coach_students` row — affecting downstream auth (`assertCoachAssignedToStudent`) and visibility.

### 4.4 No FK from `sessions` to `booked_slots`
Sessions generated from a booked slot have no link back. If the booked slot is later modified or deleted, the sessions become orphans. There is no "regenerate sessions from this slot" function because the relationship doesn't exist.

### 4.5 The `num_sessions * 3` weeks horizon can silently exceed plan duration
A monthly plan with 4 classes searches up to 12 weeks. If the student's slot is crowded, the 4 classes can land at week 0, 4, 8, 12 — spanning 3+ months. The student's `current_period_end` is ~1 month away, and the next renewal will try to schedule another 4 classes on top.

---

## 5. Preview & admin pending edit

### 5.1 PATCH on pending booking doesn't validate the new coach/time
- No check that the chosen `coach_id` has `coach_availabilities` covering the new weekday/start/end.
- No check that the coach has no existing conflict at that time.
- No check that the new time is within the student's `student_availabilities`.
- The 400 `start_date must match weekday` check uses `new Date(...).getUTCDay()` — fine, but the rest of the route doesn't validate timezone shape, doesn't sanity-check `num_sessions` upper bound, etc.

### 5.2 Preview doesn't check student-side conflicts
`previewPendingBooking` queries the coach's existing sessions, the coach's active booked slots, and active slots that overlap the student. But the per-occurrence conflict check (`hasSessionConflict`, `hasRecurringConflict`) only iterates `sessions ?? []` (filtered to the coach) and `activeSlots ?? []`. The student's own existing sessions (e.g. a sibling on the same account) aren't queried at all. Admin could approve a booking that double-books the student.

### 5.3 Preview doesn't validate student availability either
It builds the "Student available" overlay for display, but the conflict check ignores it. Admin can approve a time the student didn't say they were free for.

---

## 6. Data model concerns

### 6.1 `sessions.weekday` is denormalized
The weekday is derived from the UTC `start_time` at insert time. It is never updated when a session is rescheduled (§1.3) and can desync from the actual day in the viewer's timezone (a Sunday UTC session may be Monday AEST). Storing weekday in `sessions` is risky and redundant.

### 6.2 No `cancelled_at` / `rescheduled_from` on sessions
Once a session is changed, there is no history. No audit log of original time vs current time, no who-changed-it field.

### 6.3 No uniqueness or overlap constraints in Postgres
No `EXCLUDE USING gist (coach_id WITH =, tstzrange(start_time, end_time) WITH &&)` constraint on `sessions`. No unique constraint on `(coach_id, student_id, status='active')` in `booked_slots`. The database cannot catch any of the race conditions above on its own.

### 6.4 `booked_slots.start_time` shape is inconsistent with other tables (§3.6)

### 6.5 No "manual override" markers
A coach who is in unusual circumstances has no way to say "this one session is special — don't auto-overwrite on renewal".

---

## 7. UX / business-logic policy gaps

- No cancellation-notice policy (e.g. 24-hour cutoff for free reschedules).
- No make-up class flow when a coach cancels.
- No surface for "coach is sick this week" — admin has no batch reschedule.
- No notification on any of these mutations (parent emails, coach emails).
- No coach view of "I need to request time off".
- No max-classes-per-day per student or per coach.
- No timezone confirmation when DST changes — student isn't told their 3pm just became 4pm UTC.
- `assignCoachToStudent` falling back to `success:false` produces no support ticket / admin alert.
- Admin's "approve pending" UI has no warning for §4.5 schedule horizon overflow.
- Refunded subscriptions still show sessions on the parent's "Upcoming sessions" view (parent/schedule reads all `sessions` for the account's students regardless of subscription state).
- No "freeze account" / "pause subscription" state. Stripe pause + your DB has no representation.

---

## 8. Caching / revalidation

`assignCoachToStudent` and `approvePendingBookedSlot` only `revalidatePath("/profiles")` and `revalidatePath("/admin")`. They don't revalidate:
- `/parent` (the parent dashboard).
- `/coach` (the coach dashboard).
- `/student` (the student home).
- The various `/lessons` / `/message` routes that may surface schedule info.
Most pages re-fetch on navigation so it's mostly cosmetic, but a parent who paid and is staring at `/parent` may not see the new booking until they refresh.

---

## 9. Quick-win priority list (suggested)

1. **Subscription cancel must cancel future sessions and deactivate the booked_slot** (§1.1, §2.5). One-line fix in `/api/students/[studentId]/subscription/cancel` and the `customer.subscription.deleted` webhook handler.
2. **Renewal must generate next month's sessions** (§2.1). Either extend `approvePendingBookedSlot` to "top up" an existing active slot, or have renewal call a new `generateNextCycleSessions(bookedSlotId, numSessions)`.
3. **Approval race fix** (§4.1) — flip the `pending → active` update before inserting sessions, and key off the `.select()` count to decide whether to proceed.
4. **Postgres-side overlap exclusion** on `sessions` (§6.3) — single DDL change, eliminates a whole class of race conditions.
5. **Cascade `coach_availabilities` PUT through to active bookings** (§1.6) — at minimum surface a warning of affected slots; ideally block save when there are dependents.
6. **Build the `booked_slots` edit endpoint** (§1.2) so admins can move an active recurring slot with conflict re-check (essentially `previewPendingBooking` + `approvePendingBookedSlot` against an existing active row).
7. **Single-session reschedule with validation** (§1.3) — coach PATCH must check coach availability, student availability, and overlap.
8. **Pending booking expiry / admin alert** (§1.9, §2.4) — cron job or surface in admin dashboard.
9. **Coach blackout dates** (§1.5) — new table + matchmaking + approval consults it.
10. **Audit log on all of the above** (§4.3, §6.2) — `booked_slot_history` and `session_history`.

The deeper redesign work is (a) treating `sessions` as derivable from `booked_slots` + an exception table, and (b) introducing a Postgres function for the multi-table mutations so transactionality is real, not aspirational.
