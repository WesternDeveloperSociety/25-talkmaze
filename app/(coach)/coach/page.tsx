import { getCurrentUser } from "@/utils/supabase/lib/getCurrentUser";
import { createClient } from "@/utils/supabase/server";
import CoachPageClient from "./CoachPageClient";

export default async function CoachPage() {
  const user = await getCurrentUser();
  if (!user) throw new Error("User not found");

  const supabase = await createClient();
  const { data: account } = await supabase
    .from("account")
    .select("id, email")
    .eq("id", user.id)
    .single();

  if (!account) throw new Error("Account not found");

  return (
    <CoachPageClient
      currentUserId={account.id}
      currentUserEmail={account.email}
    />
  );
}