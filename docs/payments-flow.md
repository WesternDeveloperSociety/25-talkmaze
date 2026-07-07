# Payments Flow

End-to-end map of checkout, subscriptions, plan changes, and matchmaking triggers.

## Components

- `src/services/stripe/client.ts` — Stripe SDK setup.
- `src/lib/payments/server/`:
  - `findActiveStripeSubscriptionByStudent.ts`
  - `getStripeCustomerIdForAccount.ts` (lazy-creates `account.stripe_customer_id`)
  - `policies.ts` (refund window = 28 days)
  - `resolveStudentIdForBilling.ts`
- `src/app/api/checkout/route.ts` — entry to a new subscription.
- `src/app/api/webhooks/stripe/route.ts` — main webhook.
- `src/app/api/webhooks/stripe/learningSpace/route.ts` — internal sub-webhook for LessonSpace provisioning.
- `src/app/api/subscriptions/{cancel,resume,schedule,schedule/cancel}/route.ts` — lifecycle actions.

## First subscription lifecycle

1. **Checkout (`POST /api/checkout`)** — lazy-creates the Stripe `Customer` if `account.stripe_customer_id` is null; cancels any orphaned `incomplete` subscriptions for this student/account; creates a Stripe `Subscription` in `incomplete` state with metadata `{account_id, student_id, price_id, ...}`. Returns `clientSecret` for the embedded payment form. **Gotcha:** when `studentIdOverride === "new"` the route does not require an authenticated user — that branch supports the signup flow but trusts the session to be isolated. **Void-invoice side effect:** an `incomplete` subscription carries an `open` first invoice; cancelling it (the cleanup above, which also fires on browser-back checkout re-mounts and plan re-selection) makes Stripe **void** that invoice. So abandoned/re-selected checkouts accumulate `void` invoices on the customer. `listInvoicesForAccount` hides `void` (and `draft`) so they don't clutter the customer's Billing History; they remain visible in the Stripe dashboard.
2. **Payment confirm** — user submits the Stripe Elements form; Stripe finalises the subscription.
3. **Webhook: `invoice.paid`** — fires for first payment and every renewal. The handler:
   - Upserts `student_subscriptions` with `current_period_start/end`, sets `sessions_remaining = plan.classes`.
   - Calls `/api/webhooks/stripe/learningSpace` internally (sub-route) to provision the LessonSpace room if `students.lesson_space_id` is null. This is a **fire-and-forget HTTP call within the webhook** — if it fails, the subscription is still committed.
   - Calls `assignCoachToStudent(student_id, plan.classes)` to trigger matchmaking and create `booked_slots`.
   - **Inconsistency:** there's a comment claiming the first payment skips coach assignment (the parent triggers it from the dashboard once availability is set), but the renewal branch always runs it. When editing this route, decide which behaviour is correct and align both branches.
4. **Webhook: `customer.subscription.deleted`** — marks `student_subscriptions.status = "cancelled"`.

## Plan changes (upgrade / downgrade on renewal)

This is implemented via Stripe `SubscriptionSchedule`, not immediate proration.

1. **`POST /api/subscriptions/schedule`** — creates a Stripe `SetupIntent` (off-session) carrying `{target_price_id, stripe_subscription_id}` in metadata. The user confirms a payment method but is not charged.
2. **Webhook: `setup_intent.succeeded`** — releases any prior schedule, creates a new two-phase `SubscriptionSchedule`:
   - Phase 1: current plan, ends at `current_period_end`.
   - Phase 2: new plan, starts at `current_period_end`.
   - Stores `pending_plan_id` and `pending_stripe_schedule_id` on `student_subscriptions`.
3. **Phase transition** — Stripe fires `invoice_payment.paid` (note: distinct from `invoice.paid`). Handler activates the pending plan, clears `pending_*` columns, calls `assignCoachToStudent()` again.
4. **`POST /api/subscriptions/schedule/cancel`** — releases the `SubscriptionSchedule` and clears the pending columns before it transitions.

There is no proration / mid-cycle discount.

## Cancel & resume

- **`POST /api/subscriptions/cancel`** — two modes:
  - **Immediate** (only if within 28 days of `current_period_start`, per `policies.ts`): refunds the latest charge, sets `status = "cancelled"` and `cancelled_at` immediately.
  - **Graceful** (default): sets Stripe `cancel_at_period_end = true`, leaves `status = "active"`, records `cancelled_at` as the scheduled end.
- **`POST /api/subscriptions/resume`** — flips `cancel_at_period_end` back to `false` if still inside the period.

## Things to be careful with

- **Raw body for signature verification.** The Stripe webhook reads the raw request body as text before `stripe.webhooks.constructEvent(...)`. If you wrap the route in middleware that consumes the body, signature verification will fail silently.
- **`as any` casts.** Two casts (`invoiceAny`, `invoice as LegacyInvoice`) bridge API version drift in the Stripe invoice schema. Replace with proper Stripe SDK types when bumping the SDK.
- **Plaintext password in metadata.** `POST /api/checkout` currently stores the new user's password in Stripe subscription metadata to bootstrap the auth user from inside the webhook. This is a security smell — remove it once signup is reworked to fully create the auth user up front.
- **Pending schedule cleanup.** `setup_intent.succeeded` calls `stripe.subscriptionSchedules.release()` for any prior schedule before creating a new one. Failures are logged but not surfaced — if the release fails the user can end up with overlapping schedules.
