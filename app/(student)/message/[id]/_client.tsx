"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Message } from "@/utils/supabase/actions/messages";
import ConversationMessage from "../../components/coach-page/ConversationMessage";
import ConversationMessageInput from "../../components/coach-page/ConversationMessageInput";

export function ConversationClient({
  conversation,
  user,
  messages,
}: {
  conversation: { id: string };
  user: { id: string; name: string };
  messages: Message[];
}) {
  const [allMessages, setAllMessages] = useState<Message[]>(messages);

  // Reset when initial messages change (e.g., switching conversations)
  useEffect(() => {
    setAllMessages(messages);
  }, [messages]);

  const addMessage = (msg: Message) => {
    setAllMessages((prev) => {
      if (prev.some((m) => m.id === msg.id)) return prev;
      return [...prev, msg];
    });
  };

  useRealtimeChat({
    roomId: conversation.id,
    userId: user.id,
    onMessage: addMessage,
  });

  return (
    <div className="flex flex-col gap-4 w-full h-full min-h-0 overflow-hidden bg-[#c0f7e5] px-3 py-5 rounded-xl shadow-[inset_0_2px_5px_rgba(0,0,0,0.6)]">
      <div className="flex flex-col-reverse flex-1 min-h-0 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <div className="flex flex-col gap-2">
          {allMessages.map((message) => (
            <ConversationMessage key={message.id} {...message} />
          ))}
        </div>
      </div>

      <ConversationMessageInput
        conversationId={conversation.id}
        onMessageSent={addMessage}
      />
    </div>
  );
}

function useRealtimeChat({
  roomId,
  userId,
  onMessage,
}: {
  roomId: string;
  userId: string;
  onMessage: (msg: Message) => void;
}) {
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase.channel(`room:${roomId}:messages`, {
      config: { presence: { key: userId } },
    });

    channel
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${roomId}`,
        },
        async (payload) => {
          const record = payload.new;

          const { data: account } = await supabase
            .from("account")
            .select("email")
            .eq("id", record.sender_id)
            .maybeSingle();

          const { data: student } = await supabase
            .from("students")
            .select("name")
            .eq("account_id", record.sender_id)
            .maybeSingle();

          const { data: coach } = await supabase
            .from("coaches")
            .select("name")
            .eq("account_id", record.sender_id)
            .maybeSingle();

          onMessage({
            id: record.id,
            text: record.body,
            created_at: record.created_at,
            sender_id: record.sender_id,
            sender: {
              name: student?.name ?? coach?.name ?? account?.email ?? "Unknown",
            },
          });
        },
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [roomId, userId, onMessage]);
}
