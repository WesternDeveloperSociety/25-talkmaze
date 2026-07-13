import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/src/lib/auth/server/requireRole";
import { assertCoachOwnsConversation } from "@/src/lib/auth/server/ownership";

const ParamsSchema = z
  .object({
    id: z.string().uuid(),
  })
  .strict();

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // Stage 1: AUTH
  const auth = await requireRole([2]);
  if (auth instanceof NextResponse) return auth;
  const { supabase } = auth;

  // Stage 2: VALIDATE
  const parsed = ParamsSchema.safeParse(await params);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid request parameters",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }
  const { id: conversationId } = parsed.data;

  // Stage 3: AUTHORIZE
  const ownership = await assertCoachOwnsConversation(auth, conversationId);
  if (ownership instanceof NextResponse) return ownership;
  const conv = ownership.conversation;

  // Stage 4: EXECUTE
  try {
    // Coach display info — for sender name enrichment.
    const { data: coach } = await supabase
      .from("coaches")
      .select("account_id, first_name, last_name, avatar_url")
      .eq("id", conv.coach_id)
      .single();

    const { data, error } = await supabase
      .from("messages")
      .select("id, body, created_at, sender_id")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("conversations/[id]/messages GET query error", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }

    const messages = await Promise.all(
      (data ?? []).map(async (m) => {
        let name = "Unknown";
        let avatar_url: string | null = null;

        if (coach && m.sender_id === coach.account_id) {
          name =
            `${coach.first_name ?? ""} ${coach.last_name ?? ""}`.trim() ||
            "Unknown";
          avatar_url = coach.avatar_url ?? null;
        } else if (conv.profile_type === "student") {
          const { data: student } = await supabase
            .from("students")
            .select("first_name, last_name, avatar_url")
            .eq("id", conv.profile_id)
            .maybeSingle();
          if (student) {
            name =
              `${student.first_name ?? ""} ${student.last_name ?? ""}`.trim() ||
              "Unknown";
            avatar_url = student.avatar_url ?? null;
          }
        } else {
          const { data: parent } = await supabase
            .from("parents")
            .select("first_name, last_name, avatar_url")
            .eq("id", conv.profile_id)
            .maybeSingle();
          if (parent) {
            name =
              `${parent.first_name ?? ""} ${parent.last_name ?? ""}`.trim() ||
              "Unknown";
            avatar_url = parent.avatar_url ?? null;
          }
        }

        return {
          id: m.id,
          text: m.body,
          created_at: m.created_at,
          sender_id: m.sender_id,
          sender: { name, avatar_url },
        };
      }),
    );

    return NextResponse.json({ messages });
  } catch (err: unknown) {
    console.error("conversations/[id]/messages GET error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
