import { Message } from "@/utils/supabase/actions/messages";
import { User2Icon } from "lucide-react";

/**
 * Date formatter for message timestamps
 */
const DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  dateStyle: "short",
  timeStyle: "short",
});

/**
 * Component for an individual message
 */
export default function ConversationMessage({
  text,
  sender,
  created_at,
}: Message) {
  return (
    // The container of the user profile image and the message contents
    <div className="w-auto h-fit flex gap-3">
      {/* Profile Image */}
      {/* <div
        className="min-w-[35px] h-10 bg-white rounded-sm border
         border-black"
      >
        <p className="text-center text-[#65CFAD]">PR</p>
      </div> */}
      <User2Icon
        className="min-w-[35px] h-10 rounded-sm border
         bg-gray-300"
      />
      {/* Message contents (username, timestamp, text, etc.) */}
      <div className="px-1 pt-1 pb-2 bg-white rounded-[9px] grow">
        <div className="flex items-baseline gap-2 justify-between">
          <span className="text-sm font-semibold">{sender.name}</span>
          <span className="text-sm text-muted-foreground truncate">
            {DATE_FORMATTER.format(new Date(created_at))}
          </span>
        </div>
        <p className="whitespace-pre-wrap break-words leading-5 m-0">{text}</p>
      </div>
    </div>
  );
}
