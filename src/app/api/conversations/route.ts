import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/src/lib/auth/server/requireRole";
import { getOrCreateCoachConversation } from "@/src/lib/messaging/server/getOrCreateCoachConversation";

const BodySchema = z
  .object({
    contactId: z.string().uuid(),
  })
  .strict();

export async function POST(request: Request) {
  // Check authentication
  const auth = await requireRole([2]);
  if (auth instanceof NextResponse) return auth;
  const { supabase } = auth;

  // Validate
  const parsed = BodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid request body",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }
  const { contactId } = parsed.data;

  // Stage 3 + 4: AUTHORIZE + EXECUTE (ownership decision tree + upsert)
  const result = await getOrCreateCoachConversation(
    supabase,
    auth.user.id,
    contactId,
  );

  if ("error" in result) {
    switch (result.error) {
      case "forbidden":
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      case "notFound":
        return NextResponse.json(
          { error: "Contact not found" },
          { status: 404 },
        );
      default:
        return NextResponse.json(
          { error: "Internal server error" },
          { status: 500 },
        );
    }
  }

  return NextResponse.json({ conversationId: result.conversationId });
}
