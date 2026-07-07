# API Contract

The rules every API route in `src/app/api/**` follows. This document is **prescriptive** — when a route disagrees with this doc, the route is wrong and gets fixed when next touched.

Companion docs:
- `docs/api-auth.md` — who can call which routes (roles).
- `docs/api-ownership.md` — when an authenticated caller is allowed to act on a specific resource.

---

## The four-stage route shape

Every protected route runs four stages in this exact order. Skipping or reordering stages is the root cause of most of the bugs in `docs/repo-quality-audit.md`.

```ts
import { z } from "zod";
import { requireRole } from "@/src/lib/auth/server/requireRole";
import { assertOwnsStudent } from "@/src/lib/auth/server/ownership";
import { createClient } from "@/src/services/supabase/server";

const BodySchema = z.object({
  studentId: z.string().uuid(),
  amount: z.number().int().positive(),
});

export async function POST(req: Request) {
  // 1. AUTH — establish identity. 401 if anonymous, 403 if wrong role.
  const { user, supabase } = await requireRole(req, [1]);
  if (user instanceof Response) return user;

  // 2. VALIDATE — parse and reject malformed input. 400.
  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // 3. AUTHORIZE — confirm this caller is allowed to act on this resource. 403/404.
  const ownership = await assertOwnsStudent(supabase, user, parsed.data.studentId);
  if (ownership instanceof Response) return ownership;

  // 4. EXECUTE — business logic, ideally via src/lib/<domain>/. Return a typed shape.
  const result = await chargeStudent(supabase, parsed.data);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }
  return Response.json(result.data, { status: 201 });
}
```

**Why the order matters.** Validating before auth leaks information ("priceId is required" tells an attacker which field name to send, even unauthenticated). Authorizing before validation produces 403s for callers who would have gotten a useful 400. The audit's "404-not-401" bug in `checkout/route.ts` and `subscriptions/schedule/route.ts` is exactly this mistake — validation runs first, and unauthenticated callers get an error from a later stage that doesn't say "you need to log in."

**One exception**, and only one: routes that take no body (`GET` with no query params, no path params) skip stage 2 entirely. Routes whose path params *are* the input (e.g. `GET /api/parent/students/[studentId]`) still validate the param shape if there's any ambiguity (e.g. coerce-to-UUID).

---

## Status codes

These are the approved status codes for application-authored API responses
today. A route should not introduce a new status code unless this table, the
route docs, and relevant contract tests are updated first. An undocumented
status code is a bug.

| Code | Meaning | Example |
|---|---|---|
| `200` | Success, response body included | `GET /api/coach/sessions` returns the sessions list |
| `201` | Success, resource created | `POST /api/attendance` returns the new record |
| `204` | Success, no body | `DELETE /api/coach/sessions/[id]` |
| `400` | Caller sent something malformed (Zod validation failed, missing required field, wrong type) | Body without `priceId` |
| `401` | Caller is not authenticated (no session, expired session) | `Cookie:` header missing |
| `403` | Caller is authenticated but not permitted (wrong role OR doesn't own the resource) | Coach calls admin route |
| `404` | The resource referenced in the URL or body does not exist | `GET /api/parent/students/[invalid-uuid]` |
| `409` | Conflict with current state — caller's request is well-formed but state forbids it | Student already has an active subscription |
| `422` | Request is well-formed, caller is authorized, but business logic can't complete | Refund requested but no refundable payment found on the invoice |
| `429` | Upstream rate-limited us (retryable) | Stripe returned a rate-limit error. Emitted only by `GET /api/subscriptions/invoices` |
| `500` | Unexpected error — supabase, Stripe, or an unhandled exception | Database connection failed |
| `503` | A dependency is temporarily unavailable (retryable) — send `Retry-After` | Stripe connection error or Stripe-side 5xx. Emitted only by `GET /api/subscriptions/invoices` |
| `504` | Upstream did not respond in time (retryable) — send `Retry-After` | Stripe request timed out. Emitted only by `GET /api/subscriptions/invoices` |

`429`/`503`/`504` are **scoped to `GET /api/subscriptions/invoices`** today — it differentiates upstream
(Stripe) failures so an idempotent GET can be safely retried with backoff (see
`src/lib/payments/server/stripeErrorStatus.ts`). Every other route still returns a blanket `500` for any
unexpected error, including Stripe failures. Don't broaden this without updating this table + the route docs +
contract tests first.

### Common pitfalls

- **Never return 200 with `{ status: 404, message: "..." }` in the body.** The HTTP status code *is* the status. Routes like `src/app/api/parent/students/[studentId]/route.ts:17,23` and `src/app/api/coach/lessonspace/[coachId]/[studentId]/route.ts:27-37` do this today; both are bugs.

- **Never return 404 for "doesn't belong to you."** That's `403`. Single exception: when distinguishing "doesn't exist" from "exists but not yours" would let an attacker enumerate IDs — in which case both cases return `404` *deliberately*, and a code comment explains why. Don't fall into 404 by accident. (See `docs/api-ownership.md` for the enumeration discussion.)

- **Never return 500 for caller error.** A malformed JSON body is `400`, not `500`. Wrap `req.json()` in `.catch(() => ({}))` and let Zod produce the `400`.

- **Never return 401 from anywhere except stage 1.** If stage 1 passed and stage 4 then finds the user record is missing, that's `500` (your data is inconsistent), not `401`.

---

## Error shape

Every error response is exactly this shape:

```ts
type ErrorBody = {
  error: string;          // human-readable message, safe to show in UI
  code?: string;          // machine-readable identifier, optional
  details?: unknown;      // structured info (e.g. Zod issues), optional
};
```

```ts
// ✅ Good
return Response.json({ error: "Student not found" }, { status: 404 });
return Response.json(
  { error: "Invalid request body", code: "INVALID_BODY", details: parsed.error.flatten() },
  { status: 400 },
);

// ❌ Wrong (existing routes)
return NextResponse.json({status:404, message: "Unable to find account"});      // 200 with status in body
return NextResponse.json({ message: "...", status: 500 }, { status: 500 });     // duplicated, inconsistent key
return NextResponse.json([], { status: 400 });                                  // empty array as error body
```

**Why a single shape.** Clients should be able to write *one* error handler. Right now the codebase has at least four shapes (`{ error }`, `{ message }`, `{ status, message }`, `[]`), so every UI surface either reinvents error parsing or silently swallows mismatches.

**Don't put internal details in the error message.** "Failed to fetch students" is fine; `"connection refused at postgres://..."` is not. If you need to log internal context, `console.error` it server-side and return a generic message to the client.

**No translations.** Error messages are English, sentence case, no trailing period for short messages, period for full sentences. UI is responsible for any user-facing rewording.

---

## Input validation

**Every route validates its body with Zod.** No exceptions. No manual `typeof x === "string"` chains, no `if (!body.foo)` ladders. Manual checks miss optional fields, allow extra fields, and silently coerce.

```ts
const CreateAttendanceSchema = z.object({
  student_id: z.string().uuid(),
  session_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(["attended", "missed", "cancelled"]),
  session_id: z.number().int().optional(),
  notes: z.string().max(2000).optional(),
}).strict();  // reject unknown fields
```

### Placement

- **Route-only schema** → declare at the top of `route.ts`, above the handler. Export it if a unit test needs it.
- **Shared schema** → put in `src/lib/<domain>/schemas.ts`. Domains: `auth`, `coach`, `lessons`, `lessonspace`, `messaging`, `payments`, `profiles`, `scheduling`.

### `.strict()` by default

Use `.strict()` on every request schema. Two reasons:

1. Catches typos: a client sending `{ studentID: "..." }` gets a `400` instead of being silently ignored.
2. Catches privilege escalation: a client sneaking in `{ role: 3, ... }` to a profile-update endpoint can't sneak in field that the route accidentally forwards to the DB.

The single exception is webhook payloads from third parties (Stripe, LessonSpace) — these add new fields over time and `.strict()` would break on every API version bump. Use `.passthrough()` there and only pull the fields you need.

### Parameter validation

Path params and query params are *also* validated. The route `GET /api/coach/sessions?student_id=...` should reject `student_id=DROP TABLE` with a `400`, not pass it through to Supabase and hope.

```ts
const QuerySchema = z.object({ student_id: z.string().uuid().optional() });
const parsed = QuerySchema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
```

---

## Response shape

Every successful response is typed and consistent. Three patterns, pick the one that fits:

### Pattern A — return the entity

For `GET` of a single resource, `POST` that creates, `PUT/PATCH` that updates. The response *is* the entity.

```ts
return Response.json(student satisfies StudentDTO, { status: 200 });
```

Use `satisfies` to verify the shape against the DTO type at compile time. DTOs live in `src/lib/<domain>/types.ts`.

### Pattern B — return a named collection

For `GET` of a list. **Wrap the collection in an object** so you can add metadata (pagination, totals) later without a breaking change.

```ts
// ✅ Good — extensible
return Response.json({ sessions, total: sessions.length });

// ❌ Wrong — locked into bare array
return Response.json(sessions);
```

Two routes currently do this right (`coach/sessions` returns `{ sessions }`, `coach/conversation` returns `{ conversationId }`). Most don't (`admin/students` returns a bare array of `students` rows). Fix when touched.

### Pattern C — return success acknowledgement

For mutation routes where the caller doesn't need the entity back. Always include `success: true` so the client doesn't have to guess from status code alone.

```ts
return Response.json({ success: true }, { status: 200 });
```

**Don't return `null` or `undefined`.** Use `204 No Content` if there's genuinely nothing to say. Bare nulls confuse clients that try to `await res.json()`.

**Don't leak internal columns.** `from("students").select("*")` returns whatever the DB happens to have, including columns added later that the caller shouldn't see. Always enumerate columns in the `select()` call, *or* run the row through a Zod `parse()` that filters to a typed DTO before returning.

---

## Logging

- **`console.log` is forbidden in route handlers.** Use `console.error` only when an unexpected condition has occurred (`catch` blocks, "this should never happen" branches). Never log request bodies. Never log credentials. The `checkout/route.ts:25` password log is the cautionary tale.

- **Logs go to stdout/stderr.** No SDK-specific loggers, no log files. Production captures stdout.

- **One log line per error.** "Failed to fetch X" + the underlying error in a single call:

  ```ts
  console.error("Failed to fetch student", { studentId, error: error.message });
  ```

  Not three lines that have to be correlated by timestamp.

---

## Side effects and idempotency

- **Mutations should be idempotent where possible.** `POST /api/attendance` uses `upsert(..., { onConflict: "student_id,session_date" })`. Calling it twice produces one row, not two. Apply this pattern wherever the natural unique constraint exists.

- **Webhooks must be idempotent.** A Stripe event can arrive twice. The handler must produce the same final state either way. Today `/api/webhooks/stripe` lacks an event-ID dedupe table; until that lands, every write inside the handler must use `upsert` or include the Stripe event ID in a `WHERE` clause that prevents double-application.

- **Don't write before authorizing.** Every test for "403 when wrong role" should also assert "no row was created." If your route mutates state before the role check, that's a vulnerability — fix the ordering.

- **Compound mutations should be transactional or genuinely idempotent.** `admin/employees/[id]/availability/route.ts` does `DELETE` then `INSERT` without a transaction — if the INSERT fails, the coach has zero availability. Either wrap in a Supabase RPC (server-side function that runs in a single transaction), or restructure to `INSERT new rows, mark old rows inactive` so a partial failure leaves the system consistent.

---

## Domain logic placement

Routes are the HTTP boundary. Real work lives in `src/lib/<domain>/server/` or `src/lib/<domain>/actions/`.

A route's body should be roughly: auth, validate, authorize, **call one function**, format the response. If the route does more than that, extract.

```ts
// ✅ Good
export async function POST(req: Request) {
  const { user, supabase } = await requireRole(req, [1]);
  if (user instanceof Response) return user;

  const parsed = CreateBookingSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return badRequest(parsed.error);

  const result = await createBooking(supabase, user.id, parsed.data);
  return jsonResult(result);
}

// ❌ Wrong — 140 lines of inline lookups, conflict checks, FK joins, side effects
```

`src/app/api/coach/lesson-progress/route.ts` is the cautionary tale: 142 lines of route handler doing token awards, badge calculations, and aggregate lesson completion checks inline. That logic should be `awardProgress()` in `src/lib/lessons/server/`, with the route being ~15 lines.

---

## Webhook routes

`/api/webhooks/stripe` and `/api/webhooks/lessonspace` are different. They bypass auth (signature-verified instead), use the service-role Supabase client (no user session), and must be idempotent. They follow this contract instead:

1. **Verify signature first.** If the signature is missing or invalid, return `400`. Never log the signature itself.
2. **Parse the event** and route to a handler based on `event.type`. Unknown event types return `200` (don't retry forever) with a server-side `console.warn`.
3. **Idempotency check.** Has this `event.id` been processed? If yes, return `200` and exit.
4. **Apply the side effect.** Wrap in try/catch so a single failed event doesn't crash the route. Always return `200` to Stripe unless you want them to retry.
5. **Record the `event.id`** as processed.

The current `/api/webhooks/lessonspace` doesn't verify signatures and emails to a hardcoded address — both bugs documented in `docs/repo-quality-audit.md`. Tests live (or will live) in `tests/contract/webhooks/`.

---

## Production runs with RLS disabled

**Important environmental fact:** this codebase runs **without Row Level Security in production**. Local Supabase may have RLS enabled (depending on migrations), but prod does not.

Implications every route author must internalise:

- **The handler-level auth and ownership checks are the entire security boundary.** There is no second line of defense. A handler that forgets to filter `coach_id` leaks every coach's data in prod — RLS will not catch it.
- **The "user-scoped client" and the "service-role client" are functionally equivalent in prod.** Both bypass RLS because there's no RLS to bypass. The audit's warnings about `createServiceRoleClient()` misuse are still correct — service-role usage in non-webhook routes is a bug — but the fix isn't "switch to the user client and let RLS protect you." The fix is **add explicit ownership filtering**.
- **`requireRole` and the ownership helpers (`docs/api-auth.md`, `docs/api-ownership.md`) are load-bearing, not redundant.** Every route that touches a per-user resource must call them. There is no scenario where "RLS will block this if I miss" is true.
- **Never write a route that relies on RLS as a secondary check.** If you find yourself thinking "the policy will catch any leak," stop. The policy isn't there.

### Test isolation implication

Integration tests run against local Supabase, which may have RLS enabled. A test that passes locally because RLS blocked a missing handler check **does not prove the same code is safe in prod**. To match prod honestly, prefer running integration tests against an RLS-disabled local instance (or assert behaviour explicitly via the service-role client, not the user client, in setup).

If/when RLS is enabled in prod as a separate project, the handler-level checks remain correct and become belt-and-suspenders. The migration to that state is not a prerequisite for this contract rewrite; the rewrite makes the codebase safer in the *current* RLS-off state by forcing the explicit checks.

---

## The service-role escape hatch

`createServiceRoleClient()` from `src/services/supabase/service.ts` bypasses RLS. **Only valid in:**

- The two webhook routes (no user session exists).
- Test setup code (`tests/helpers/factories.ts`, `tests/helpers/db.ts`).
- One-off scripts in `scripts/` if any exist.

It is **not** valid in:
- Admin routes that "want to bypass RLS for convenience" (e.g. the four `pending-bookings` routes today). Use the user-scoped client and let RLS confirm the admin's permission.
- Any route in the `(families)` or `(coach)` route groups.

When you see `createServiceRoleClient()` in a non-webhook route, that's a bug. Fix it when you touch the file.

---

## Migration plan

As of 2026-05-20 the codebase matches this spec — see `docs/test-rewrite-runbook.md` for the rewrite history and `docs/repo-quality-audit.md` for tracked residuals. New routes follow the rules below from day one.

**When editing any route:**
1. Read the contract above.
2. If the route doesn't match, fix it as part of your change.
3. Don't add new tests that pin the old contract — tests follow the rules in this doc.

**When adding a new route:**
1. Start from the four-stage shape at the top of this doc.
2. Write the Zod schema before the handler logic.
3. Use `requireRole` and `assertOwns*` helpers (see `docs/api-auth.md`, `docs/api-ownership.md`).
4. Write tests against this contract, not against your implementation.
