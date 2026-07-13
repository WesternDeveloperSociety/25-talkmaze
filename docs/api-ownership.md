# API Ownership

Authentication answers *who is calling*. Authorization-by-role (`docs/api-auth.md`) answers *what kind of caller they are*. This document answers the third question every protected route must ask: **is this caller allowed to act on this specific resource?**

Most of the audit's CRITICAL findings are ownership bugs, not auth bugs. A coach can be authenticated as a coach (`requireRole([2])` passes) and still not be the coach assigned to the student whose lesson progress they're trying to update. Today, many routes skip that second check.

Companion docs:
- `docs/api-contract.md` — route shape, status codes, error format.
- `docs/api-auth.md` — who can call which routes by role.

---

## The four ownership relationships

The data model has exactly four authorization relationships that matter at the route layer. Every ownership check the API performs is one of these.

| Actor | Resource | Relationship | DB tables |
|---|---|---|---|
| Family (role 1) | Student | `students.account_id === caller.id` | `students` |
| Family (role 1) | Parent profile | `parents.account_id === caller.id` | `parents` |
| Family (role 1) | Subscription | `students.account_id === caller.id` AND `student_subscriptions.student_id === student.id` | `students`, `student_subscriptions` |
| Coach (role 2) | Student | `(coach_id, student_id)` row exists in `coach_students` | `coaches`, `coach_students` |
| Coach (role 2) | Conversation | `conversations.coach_id === caller.coach.id` | `conversations` |
| Coach (role 2) | Session | `sessions.coach_id === caller.coach.id` | `sessions` |
| Admin (role 3) | Anything | Role gate is sufficient — admins bypass ownership | — |

There is no "ownership" for admin routes. Admin = elevated trust by definition. Adding multi-tenant admin scoping (e.g. "this admin only manages this org") is out of scope today; if/when that lands, add a row here.

---

## The helpers

Like `requireRole`, these helpers do not exist yet. Add them as the second concrete code change. Each returns the resource on success or a `NextResponse` on failure.

### `assertOwnsStudent`

For family-acting-on-student routes (parent dashboards, checkout, subscription management, profile selection).

```ts
// src/lib/auth/server/ownership.ts
import type { AuthContext } from "./requireRole";
import { NextResponse } from "next/server";

export async function assertOwnsStudent(
  { supabase, user }: AuthContext,
  studentId: string,
): Promise<{ student: { id: string; account_id: string } } | NextResponse> {
  const { data: student } = await supabase
    .from("students")
    .select("id, account_id")
    .eq("id", studentId)
    .single();

  if (!student) {
    // Distinguish "doesn't exist" from "not yours" — see "Enumeration" below.
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }
  if (student.account_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return { student };
}
```

### `assertCoachAssignedToStudent`

For coach-acting-on-student routes (lesson feedback, lesson progress, lesson tasks, attendance writes, the per-student LessonSpace link, the conversation initiation).

```ts
export async function assertCoachAssignedToStudent(
  { supabase, user }: AuthContext,
  studentId: string,
): Promise<{ coachId: string; studentId: string } | NextResponse> {
  // Resolve coach row (auth gate already confirmed role === 2)
  const { data: coach } = await supabase
    .from("coaches")
    .select("id")
    .eq("account_id", user.id)
    .single();
  if (!coach) {
    console.error("assertCoachAssignedToStudent: role=2 but no coaches row", { userId: user.id });
    return NextResponse.json({ error: "Coach record missing" }, { status: 500 });
  }

  const { data: assignment } = await supabase
    .from("coach_students")
    .select("coach_id")
    .eq("coach_id", coach.id)
    .eq("student_id", studentId)
    .maybeSingle();

  if (!assignment) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return { coachId: coach.id, studentId };
}
```

### `assertCoachOwnsConversation`

For `GET /api/conversations/[id]/messages`-style routes. The conversation already encodes the (coach, profile) pair, so the check is direct.

```ts
export async function assertCoachOwnsConversation(
  { supabase, user }: AuthContext,
  conversationId: string,
): Promise<{ conversation: ConversationRow } | NextResponse> {
  const { data: coach } = await supabase
    .from("coaches").select("id").eq("account_id", user.id).single();
  if (!coach) return /* 500 as above */;

  const { data: conv } = await supabase
    .from("conversations")
    .select("id, coach_id, profile_id, profile_type")
    .eq("id", conversationId)
    .maybeSingle();

  if (!conv) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }
  if (conv.coach_id !== coach.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return { conversation: conv };
}
```

### `assertOwnsSubscription`

Wrapper that composes `assertOwnsStudent` with a subscription lookup. The existing `resolveStudentIdForBilling()` helper in `src/lib/payments/server/` does this already — keep using it for subscription routes. Don't reinvent.

---

## When to call which helper

The contract is one ownership call per route, immediately after `requireRole`, before any business logic.

```ts
export async function PATCH(req: Request) {
  // 1. Auth
  const auth = await requireRole([2]);
  if (auth instanceof Response) return auth;

  // 2. Validate
  const parsed = LessonFeedbackSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return badRequest(parsed.error);

  // 3. Authorize on the specific resource
  const ownership = await assertCoachAssignedToStudent(auth, parsed.data.student_id);
  if (ownership instanceof Response) return ownership;

  // 4. Execute
  await saveLessonFeedback(auth.supabase, parsed.data);
  return Response.json({ success: true });
}
```

If a route mutates multiple resources, run the ownership check for each before any write. *All* checks pass *first*, then the writes happen. Otherwise a partial mutation leaves data inconsistent when the second check fails.

---

## The enumeration question

When a caller asks for a resource they don't own, the route can return either `404` (lies about existence) or `403` (admits the resource exists but says no). Both are defensible. **Pick one per route and document it inline.**

The default in this repo: **`404` for "doesn't exist," `403` for "exists but not yours."** Two reasons:

1. Honest semantics. A `403` is the truthful answer to "you can't have this."
2. The audit called out the old parent-students route (now `GET /api/students/[studentId]`) specifically for returning `200` with `{ status: 404 }` in the body. Fixing that to a real `404` was the obvious next step; making it `403` for "exists but not yours" the obvious step after.

**The exception**: routes where IDs are sequential, guessable, or otherwise enumerable. None today (everything is UUIDs), but if a future route exposes an integer ID (`sessions.id` is `bigint`, for example), use `404` for both cases and add a comment:

```ts
if (!session || session.coach_id !== coach.id) {
  // 404 for both to prevent ID enumeration — sessions.id is sequential.
  return NextResponse.json({ error: "Session not found" }, { status: 404 });
}
```

The helpers above default to the "honest" pattern (`404` for missing, `403` for forbidden). Override per route when enumeration is a real risk.

---

## Per-route ownership matrix

Every route that has a resource ID in its path, query, or body needs an ownership check. The complete map:

### Family-facing (role 1)

| Route | Resource | Check |
|---|---|---|
| `GET /api/students/[studentId]` | student | `assertOwnsStudent` |
| `GET /api/students/[studentId]/availability` | student | `assertOwnsStudent` |
| `PUT /api/students/[studentId]/availability` | student | `assertOwnsStudent` |
| `PATCH /api/students/[studentId]/active-course` | student | `assertOwnsStudent` |
| `PATCH /api/parents/setup` | own account | implicit (mutates `user.id`'s own rows) |
| `POST /api/checkout` (studentId !== "new") | student | `assertOwnsStudent` |
| `POST /api/students/[studentId]/subscription/cancel` | subscription via student | `resolveStudentIdForBilling` |
| `POST /api/students/[studentId]/subscription/resume` | subscription via student | `resolveStudentIdForBilling` |
| `POST /api/students/[studentId]/subscription/schedule` | subscription via student | `resolveStudentIdForBilling` |
| `DELETE /api/students/[studentId]/subscription/schedule` | subscription via student | `resolveStudentIdForBilling` |

### Coach-facing (role 2)

| Route | Resource | Check |
|---|---|---|
| `PATCH /api/lesson-progress/feedback` | student via body | `assertCoachAssignedToStudent(body.student_id)` |
| `PATCH /api/lesson-progress` | student via body | `assertCoachAssignedToStudent(body.student_id)` |
| `PATCH /api/lesson-tasks` | student via FormData | `assertCoachAssignedToStudent(form.student_id)` |
| `GET /api/lessons` | student via query | `assertCoachAssignedToStudent(query.studentId)` |
| `GET /api/sessions` (coach leg) | self-scoped — filter by `coach_id` from session | none, but query MUST filter |
| `GET /api/sessions?student_id=X` (coach leg) | student via query | `assertCoachAssignedToStudent(query.student_id)` OR return empty (see "scope" below) |
| `PATCH /api/sessions/[id]` | session | `assertCoachOwnsSession(params.id)` |
| `POST /api/conversations` | contact via body | `assertCoachAssignedToStudent(body.contactId)` |
| `GET /api/conversations/[id]/messages` | conversation | `assertCoachOwnsConversation(params.id)` |
| `GET /api/students/[studentId]/parent` | student | `assertCoachAssignedToStudent(params.studentId)` |
| `GET /api/lessonspace/rooms/[studentId]` | student | `assertCoachAssignedToStudent(params.studentId)` |
| `POST /api/attendance` | student via body | `assertCoachAssignedToStudent(body.student_id)` |
| `DELETE /api/attendance` | student via body | `assertCoachAssignedToStudent(body.student_id)` |
| `GET /api/attendance` | student via query | family OR assigned coach (see "mixed-actor" below) |

### Admin-facing (role 3)

Admins bypass ownership. Role gate is sufficient. **But:** admin actions should still log who took the action (audit trail) — use the `account.email` from the auth context. Admins are accountable even if they're not constrained.

### Mixed-actor routes

`GET /api/attendance` is the lone case where the caller may be either the student's family OR the coach assigned to the student. The ownership check splits on `account.role`:

```ts
const auth = await requireRole([]);              // any authed
if (auth instanceof Response) return auth;
const parsed = QuerySchema.safeParse(...);

const own = auth.account.role === 1
  ? await assertOwnsStudent(auth, parsed.data.student_id)
  : auth.account.role === 2
  ? await assertCoachAssignedToStudent(auth, parsed.data.student_id)
  : { admin: true };                              // role 3
if ("error" in own && own instanceof Response) return own;
```

Today's route does *neither* check (audit: "GET ownership — different family can read any student's attendance"). Fixing this is one of the highest-value ownership wins because attendance data is one query away from leaking which days a student missed.

---

## Routes that need ownership fixes (audit-mapped)

These are the routes that were missing ownership checks when the audit ran, drawn from `docs/repo-quality-audit.md`. All were fixed during the contract rewrite; they are listed here by their **current** resource-oriented paths (the audit predates the July-2026 route refactor).

**Coach routes (no `coach_students` check):**
- `PATCH /api/lesson-progress/feedback`
- `PATCH /api/lesson-progress`
- `PATCH /api/lesson-tasks`
- `GET /api/lessons`
- `POST /api/conversations`
- `GET /api/conversations/[id]/messages`
- `GET /api/lessonspace/rooms/[studentId]` — *also* missing role check

**Parent routes (no `students.account_id` check):**
- `GET /api/students/[studentId]` — returned 200 with status-in-body 404, audit-flagged

**Attendance:**
- `GET /api/attendance` — no family/coach ownership
- `POST /api/attendance` — no coach assignment check
- `DELETE /api/attendance` — no coach assignment check

Fixing each of these turned an audit-driven RED integration test GREEN (the assertions now live in the per-route 5-question test files under `tests/integration/api/`). That's the regression net.

---

## Common bugs the helpers prevent

### Trusting the URL or body for identity

```ts
// ❌
const { coachId, studentId } = await params;
const link = await createTeacherLink({ coachAccountId: coachId, studentId });
// — coachId could be anyone's; no check that user.id === coachId.
```

This was the pre-refactor `coach/lessonspace/[coachId]/[studentId]` route (now `GET /api/lessonspace/rooms/[studentId]`). It took a coach ID from the URL and treated it as the calling coach's ID — any user could mint a LessonSpace teacher link for any coach/student pair.

**Fix.** Don't trust URL params for identity. Use the auth context. If a route exposes a `coachId` in the path for historical reasons, *verify* it matches `user.id`:

```ts
const auth = await requireRole([2]);
if (auth instanceof Response) return auth;
const { coachId, studentId } = await params;
if (coachId !== auth.user.id) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
const ownership = await assertCoachAssignedToStudent(auth, studentId);
if (ownership instanceof Response) return ownership;
```

Better: drop `coachId` from the path entirely; the auth context already knows who the coach is. That is what the current route does — `GET /api/lessonspace/rooms/[studentId]` has no `coachId` segment.

### Filter-only "scoping" without explicit ownership check

```ts
// ⚠️
const sessions = await supabase.from("sessions")
  .select("*")
  .eq("coach_id", coachData.id)
  .eq("student_id", query.student_id);  // optional filter
```

This is the coach leg of `GET /api/sessions` (`src/app/api/sessions/route.ts`) today. It scopes by `coach_id` correctly, so a coach can't see another coach's sessions. But when the route applies the `?student_id=X` filter, it returns an empty array when `X` belongs to another coach — silently. A test that asserts "200 + empty array" (which `ownership.test.ts:272-282` does) misses the case where the coach is genuinely unaware they're querying outside their scope.

Two acceptable resolutions:
1. **Hard fail.** When `student_id` is provided, `assertCoachAssignedToStudent` first. Foreign student → `403`.
2. **Soft fail.** Return empty `{ sessions: [] }` and document it.

Both are fine. Pick one. Don't accidentally have one route do `(1)` and another do `(2)`.

### Composite mutations without per-resource checks

```ts
// ❌
await supabase.from("student_tokens").upsert({ student_id, token_id });
await supabase.from("student_badges").upsert({ student_id, badge_id });
```

If `student_id` was sourced from the request body, both writes need the ownership check upstream. One ownership check covers both writes — but it must happen *before* either write.

---

## Migration sequencing

1. **Build the helpers.** `src/lib/auth/server/requireRole.ts` and `src/lib/auth/server/ownership.ts`. ~80 lines total. Unit-testable.
2. **Apply to the subscription actions (`students/[studentId]/subscription/*`) as the template.** Already has `resolveStudentIdForBilling`; wrap with `requireRole`. Rewrite the test file (see Step 2 in the rollout plan).
3. **Apply to the audit's critical-list routes.** Each fix flips RED tests to GREEN; the count drops visibly per PR.
4. **Sweep the rest.** Routes that already auth correctly need only the helper substitution. Routes that don't need both `requireRole` and an ownership helper added.

By the end of the sweep, no route should call `supabase.auth.getUser()` directly — that lookup lives inside `requireRole` only. A grep for `auth.getUser` outside `src/lib/auth/` should return zero results in route handlers (it will still appear in middleware and the auth lib itself).
