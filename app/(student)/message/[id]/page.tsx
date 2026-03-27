import { getCurrentUser } from "@/utils/supabase/lib/getCurrentUser";
import { ConversationClient } from "./_client";
import { createClient } from "@/utils/supabase/server";

export default async function CoachConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;
  const contactId = resolvedParams.id;
  if (!contactId) throw new Error("No contact ID provided");

  const user = await getUser();
  if (!user) throw new Error("User not found");

  const conversation = await getConversation(user.id, contactId);
  const messages = await getMessages(conversation.conversationId);

  return (
    <ConversationClient
      conversation={{ id: conversation.conversationId }}
      user={{ id: user.id, name: user.email }}
      messages={messages}
    />
  );
}

async function getUser() {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("account")
    .select("id, email")
    .eq("id", user.id)
    .single();

  if (error) return null;
  return data;
}

async function getConversation(userId: string, contactId: string) {
  const supabase = await createClient();

  const [{ data: accountExists }, { data: studentExists }] = await Promise.all([
    supabase.from("account").select("id").eq("id", contactId).single(),
    supabase.from("students").select("account_id").eq("id", contactId).single(),
  ]);

  if (!accountExists && !studentExists) {
    throw new Error("The selected contact does not exist.");
  }

  // If the contact is a student, resolve their account_id
  const resolvedContactId = studentExists?.account_id ?? contactId;

  // Reliable two-query lookup
  const [{ data: conv1 }, { data: conv2 }] = await Promise.all([
    supabase.from("conversations").select("id").eq("sender_id", userId).eq("recipient_id", resolvedContactId).maybeSingle(),
    supabase.from("conversations").select("id").eq("sender_id", resolvedContactId).eq("recipient_id", userId).maybeSingle(),
  ]);

  const existing = conv1 ?? conv2;
  if (conv1 && conv2) {
  console.warn("DUPLICATE CONVERSATIONS FOUND", conv1.id, conv2.id);
}
  if (existing) return { conversationId: existing.id };

  const { data: newConversation, error: insertError } = await supabase
    .from("conversations")
    .insert({ sender_id: userId, recipient_id: resolvedContactId })
    .select("id")
    .single();

  if (insertError) {
    console.error("Error creating conversation:", insertError);
    throw insertError;
  }

  return { conversationId: newConversation.id };
}

async function getMessages(conversationId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("messages")
    .select("id, body, created_at, sender_id")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching messages:", error);
    return [];
  }

  const messages = await Promise.all(
  data.map(async (m) => {
    const { data: account } = await supabase
      .from("account")
      .select("email")
      .eq("id", m.sender_id)
      .maybeSingle();

    const { data: student } = await supabase
      .from("students")
      .select("name")
      .eq("account_id", m.sender_id)
      .maybeSingle();

    const { data: coach } = await supabase
      .from("coaches")
      .select("name")
      .eq("account_id", m.sender_id)
      .maybeSingle();

    return {
      id: m.id,
      text: m.body,
      created_at: m.created_at,
      sender_id: m.sender_id,
      sender: {
        name:
          student?.name ??
          coach?.name ??
          account?.email ??
          "Unknown",
      },
    };
  })
);

  return messages;
}