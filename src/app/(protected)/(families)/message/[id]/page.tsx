import { getCurrentUser } from "@/src/lib/auth/server/getCurrentUser";
import { getActiveProfile } from "@/src/lib/profiles/server/getActiveProfile";
import { markConversationRead } from "@/src/lib/messaging/server/markConversationRead";
import { getOrCreateConversationForViewer } from "@/src/lib/messaging/server/getOrCreateConversationForViewer";
import { getConversationMessages } from "@/src/lib/messaging/server/getConversationMessages";
import { getCurrentSender } from "@/src/lib/messaging/server/getCurrentSender";
import { ConversationClient } from "@/src/components/common/messaging/ConversationClient";
import { createClient } from "@/src/services/supabase/server";
import { fullName } from "@/src/utils/formatName";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const supabase = await createClient();
    const { data: coach } = await supabase
      .from("coaches")
      .select("first_name, last_name")
      .eq("account_id", id)
      .maybeSingle();
    return { title: fullName(coach?.first_name, coach?.last_name, "Messages") };
  } catch {
    return { title: "Messages" };
  }
}

/**
 * Renders a conversation page for the given contact.
 * Resolves the current account, scopes by active profile for role=1 users,
 * ensures a conversation exists, and loads message history for the client UI.
 */
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

  // Only scope conversations to the active profile for regular users (role=1)
  const profile = user.role === 1 ? await getActiveProfile() : null;

  const conversationId = await getOrCreateConversationForViewer(
    user.id,
    user.role,
    contactId,
    profile,
  );

  // Opening the conversation clears its unread count for the family viewer.
  // The RPC authorizes via auth.uid(), so no profile id needs to be passed.
  if (user.role === 1) {
    await markConversationRead(conversationId);
  }

  const messages = await getConversationMessages(conversationId);
  const currentSender = await getCurrentSender(user.id, user.role, profile);

  return (
    <ConversationClient
      conversation={{ id: conversationId }}
      user={{
        id: user.id,
        name: currentSender.name,
        avatar_url: currentSender.avatar_url,
      }}
      messages={messages}
    />
  );
}

/**
 * Get the authenticated account row with role information.
 * @returns Account row as an object
 *          NULL when there is no active auth session or account lookup fails.
 */
async function getUser() {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("account")
    .select("id, email, role")
    .eq("id", user.id)
    .single();

  if (error) return null;
  return data;
}
