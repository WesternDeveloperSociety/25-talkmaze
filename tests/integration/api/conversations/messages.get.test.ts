/**
 * Contract tests for GET /api/conversations/[id]/messages.
 *
 * Returns the messages in a conversation, enriched with sender name + avatar.
 * Read-only.
 *
 * Five questions:
 *   Q1 ownership — assertCoachOwnsConversation(id)
 *   Q2 validation — id path param required + UUID + .strict()
 *   Q3 response — { messages: [...] } named collection (not bare array)
 *   Q4 side effects — none (read)
 *   Q5 external calls — none
 */
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from "vitest";
import { createClient } from "@supabase/supabase-js";
import {
  createAccount,
  createCoach,
  createStudent,
  linkCoachToStudent,
} from "@tests/helpers/factories";
import { signSessionFor } from "@tests/helpers/auth";
import { resetAll } from "@tests/helpers/db";
import { call } from "@tests/helpers/request";
import { server } from "@tests/helpers/msw";

import { GET as messagesGET } from "@/src/app/api/conversations/[id]/messages/route";

beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterAll(() => server.close());
beforeEach(resetAll);

async function seedConversationWithMessage() {
  const adminDb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { account: coachAccount, coach } = await createCoach();
  const familyAccount = await createAccount({ role: 1 });
  const student = await createStudent(familyAccount);
  await linkCoachToStudent(coach, student);
  const cookies = await signSessionFor(coachAccount);

  const { data: conv } = await adminDb
    .from("conversations")
    .insert({
      coach_id: coach.id,
      profile_id: student.id,
      profile_type: "student",
    })
    .select()
    .single();

  // Seed one message in the conversation.
  await adminDb.from("messages").insert({
    conversation_id: conv!.id,
    sender_id: coachAccount.id,
    body: "hello",
  });

  return { coachAccount, coach, student, cookies, conversation: conv! };
}

// Q1
describe("GET /api/conversations/[id]/messages — ownership", () => {
  it("returns 403 when coach does not own the conversation", async () => {
    const { conversation } = await seedConversationWithMessage();
    const { account: otherAccount } = await createCoach();
    const otherCookies = await signSessionFor(otherAccount);

    const res = await call(messagesGET, {
      cookies: otherCookies,
      params: { id: conversation.id },
    });
    expect(res.status).toBe(403);
  });

  it("returns 404 when the conversation does not exist", async () => {
    const { cookies } = await seedConversationWithMessage();
    const res = await call(messagesGET, {
      cookies,
      params: { id: "00000000-0000-0000-0000-000000000000" },
    });
    expect(res.status).toBe(404);
  });

  it("returns 200 when coach owns the conversation", async () => {
    const { cookies, conversation } = await seedConversationWithMessage();
    const res = await call(messagesGET, {
      cookies,
      params: { id: conversation.id },
    });
    expect(res.status).toBe(200);
  });
});

// Q2
describe("GET /api/conversations/[id]/messages — input validation", () => {
  it("returns 400 when the id param is missing", async () => {
    const { cookies } = await seedConversationWithMessage();
    const res = await call(messagesGET, { cookies });
    expect(res.status).toBe(400);
  });

  it("returns 400 when the id param is malformed (not a UUID)", async () => {
    const { cookies } = await seedConversationWithMessage();
    const res = await call(messagesGET, {
      cookies,
      params: { id: "not-a-uuid" },
    });
    expect(res.status).toBe(400);
  });

  it("error responses use the { error: string } shape", async () => {
    const { cookies } = await seedConversationWithMessage();
    const res = await call(messagesGET, { cookies });
    const body = await res.json<{ error?: string; message?: string; status?: number }>();
    expect(typeof body.error).toBe("string");
    expect(body.message).toBeUndefined();
    expect(body.status).toBeUndefined();
  });
});

// Q3
describe("GET /api/conversations/[id]/messages — response shape", () => {
  it("returns { messages: [...] } named collection (not a bare array)", async () => {
    const { cookies, conversation } = await seedConversationWithMessage();
    const res = await call(messagesGET, {
      cookies,
      params: { id: conversation.id },
    });
    expect(res.status).toBe(200);
    const body = await res.json<{ messages: unknown[] }>();
    expect(Array.isArray(body.messages)).toBe(true);
    expect(body.messages.length).toBeGreaterThan(0);
  });

  it("each message has id, text, created_at, sender_id, sender", async () => {
    const { cookies, conversation } = await seedConversationWithMessage();
    const res = await call(messagesGET, {
      cookies,
      params: { id: conversation.id },
    });
    const body = await res.json<{
      messages: Array<{
        id: string;
        text: string;
        created_at: string;
        sender_id: string;
        sender: { name: string; avatar_url: string | null };
      }>;
    }>();
    const m = body.messages[0];
    expect(typeof m.id).toBe("string");
    expect(m.text).toBe("hello");
    expect(typeof m.created_at).toBe("string");
    expect(typeof m.sender_id).toBe("string");
    expect(typeof m.sender.name).toBe("string");
  });
});

// Q4: pure read, no side effects.
// Q5: no external calls.
