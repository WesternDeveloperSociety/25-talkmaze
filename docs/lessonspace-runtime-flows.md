# LessonSpace Runtime Map

This document explains how LessonSpace is used at runtime in TalkMaze: what triggers it, which files run, what gets stored, and how student/coach links are generated.

---

## What LessonSpace Does In This App

LessonSpace is the external video-room provider.

TalkMaze uses it to:

1. Provision a student room after successful payment.
2. Generate a student launch URL when a student clicks "Start Video Lesson".
3. Generate a coach launch URL when a coach clicks "Lesson Space".
4. Receive LessonSpace webhook callbacks (summary/transcription/session events).

---

## Key Database Fields

LessonSpace state is stored on `students`:

- `lesson_space_id` -> persistent LessonSpace room identity
- `lesson_space_student_link` -> latest generated student join URL
- `lesson_space_teacher_link` -> latest generated coach join URL
- `webhook_room_id` -> room id used to match incoming LessonSpace webhooks

Reference: [src/services/supabase/types/database.ts](../src/services/supabase/types/database.ts)

---

## File Roles (By Layer)

### Provider adapter (`services`)

- [src/services/lessonspace/rooms.ts](../src/services/lessonspace/rooms.ts)
  - Sends HTTP calls to LessonSpace (`/v2/spaces/launch/`).
  - Builds payloads for student and teacher launch.
  - Does not touch Supabase.

### Domain orchestration (`lib`)

- [src/lib/lessonspace/server/participants.ts](../src/lib/lessonspace/server/participants.ts)
  - Calls adapter functions.
  - Reads/writes Supabase student/coach data.
  - Persists generated lesson links and webhook room ids.

- [src/lib/lessonspace/actions/getLessonSpace.ts](../src/lib/lessonspace/actions/getLessonSpace.ts)
  - Student-facing server action entrypoint.

### API/webhook entrypoints (`app/api`)

- [src/app/api/lessonspace/rooms/[studentId]/route.ts](../src/app/api/lessonspace/rooms/[studentId]/route.ts)
  - Coach-facing endpoint to create teacher launch link (coach identity comes from the session, not the URL).

- [src/app/api/webhooks/stripe/learningSpace/route.ts](../src/app/api/webhooks/stripe/learningSpace/route.ts)
  - Internal provisioning endpoint (called from Stripe webhook flow).

- [src/app/api/webhooks/lessonspace/route.tsx](../src/app/api/webhooks/lessonspace/route.tsx)
  - Receives LessonSpace callbacks (summary path currently implemented).

---

## Runtime Flow 1: Provision Room After Payment

Trigger: Stripe webhook `invoice.paid`.

```text
Stripe -> /api/webhooks/stripe
       -> fetch /api/webhooks/stripe/learningSpace { student_id }
       -> create lesson_space_id if missing
       -> createAndPersistStudentParticipantLink(includeWebhooks=true)
       -> LessonSpace launch API
       -> save lesson_space_student_link + webhook_room_id
```

Primary files:

- [src/app/api/webhooks/stripe/route.ts](../src/app/api/webhooks/stripe/route.ts) (caller)
- [src/app/api/webhooks/stripe/learningSpace/route.ts](../src/app/api/webhooks/stripe/learningSpace/route.ts) (provision)
- [src/lib/lessonspace/server/participants.ts](../src/lib/lessonspace/server/participants.ts) (persist)
- [src/services/lessonspace/rooms.ts](../src/services/lessonspace/rooms.ts) (provider call)

---

## Runtime Flow 2: Student Starts Video Lesson

Trigger: Student clicks "Start Video Lesson" in navbar.

```text
StartVideoLessonBox button
-> server action getLessonSpace()
-> get active profile from cookies (must be student)
-> read student's lesson_space_id
-> createAndPersistStudentParticipantLink(includeWebhooks=false)
-> LessonSpace launch API
-> return client_url
-> browser redirects to client_url
```

Primary files:

- [src/app/(protected)/(families)/_components/navigation/StartVideoLessonBox.tsx](../src/app/(protected)/(families)/_components/navigation/StartVideoLessonBox.tsx)
- [src/lib/lessonspace/actions/getLessonSpace.ts](../src/lib/lessonspace/actions/getLessonSpace.ts)
- [src/lib/profiles/server/getActiveProfile.ts](../src/lib/profiles/server/getActiveProfile.ts)
- [src/lib/lessonspace/server/participants.ts](../src/lib/lessonspace/server/participants.ts)

---

## Runtime Flow 3: Coach Starts Lesson Space

Trigger: Coach clicks "Lesson Space" on a student row.

```text
Coach UI calls /api/lessonspace/rooms/{studentId}
-> route resolves the calling coach's account_id (from the session) -> coach id
-> createAndPersistTeacherParticipantLink()
-> read student room + coach profile
-> LessonSpace teacher launch API
-> save lesson_space_teacher_link
-> return client_url
-> browser redirects to client_url
```

Primary files:

- [src/app/(protected)/coach/students/[studentId]/_components/StudentHeaderBanner.tsx](../src/app/(protected)/coach/students/[studentId]/_components/StudentHeaderBanner.tsx)
- [src/app/api/lessonspace/rooms/[studentId]/route.ts](../src/app/api/lessonspace/rooms/[studentId]/route.ts)
- [src/lib/lessonspace/server/participants.ts](../src/lib/lessonspace/server/participants.ts)
- [src/services/lessonspace/rooms.ts](../src/services/lessonspace/rooms.ts)

---

## Runtime Flow 4: LessonSpace Callback Webhook

Trigger: LessonSpace sends callback for room/session events.

```text
LessonSpace -> /api/webhooks/lessonspace
            -> parse body.room.id
            -> find student by webhook_room_id
            -> if summary exists, send summary email
```

Primary files:

- [src/app/api/webhooks/lessonspace/route.tsx](../src/app/api/webhooks/lessonspace/route.tsx)
- [src/app/api/webhooks/lessonspace/components/email_template.tsx](../src/app/api/webhooks/lessonspace/components/email_template.tsx)

---

## Current Behavior Notes

1. Student start flow requires `lesson_space_id` to already exist; otherwise it throws "Unable to find room".
2. Provisioning endpoint currently returns `"Room already exists"` (without generating a fresh URL) if `lesson_space_id` is already present.
3. Summary email route fetches the account email, but currently sends to a hardcoded address (`wdstalkmaze@gmail.com`).

---

## Quick Trace Checklist

If LessonSpace "doesn't work", check in this order:

1. Does student row have `lesson_space_id`?
2. Are `LESSONSPACE_API_KEY` and `LESSONSPACE_WEBHOOK_URL` set?
3. Does launch call return `client_url` and `room_id`?
4. Are `lesson_space_student_link` / `lesson_space_teacher_link` being written?
5. Is `webhook_room_id` present for webhook correlation?
6. Are webhook requests reaching `/api/webhooks/lessonspace`?
