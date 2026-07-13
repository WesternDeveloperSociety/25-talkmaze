import "server-only";

import { createClient } from "@/src/services/supabase/server";

/**
 * Finds or creates a conversation between a coach and a profile.
 * For role=1 users, contactId is a coach account_id and profile comes from
 * the active profile context. For coach/admin users, contactId is treated as
 * a student/parent profile id and the conversation is upserted.
 */
export async function getOrCreateConversationForViewer(
  userId: string,
  userRole: number,
  contactId: string,
  profile: { id: string; type: "student" | "parent" } | null,
): Promise<string> {
  const supabase = await createClient();

  // Check if current user is a parent, student, or coach
  if (userRole === 1 && profile) {
    // Regular user (student or parent): contactId is a coach's account_id
    const { data: coach } = await supabase
      .from("coaches")
      .select("id")
      .eq("account_id", contactId)
      .single();

    if (!coach) throw new Error("Coach not found for contact.");

    const { data: existing } = await supabase
      .from("conversations")
      .select("id")
      .eq("coach_id", coach.id)
      .eq("profile_id", profile.id)
      .maybeSingle();

    if (existing) return existing.id;

    const { data: newConv, error } = await supabase
      .from("conversations")
      .insert({
        coach_id: coach.id,
        profile_id: profile.id,
        profile_type: profile.type,
      })
      .select("id")
      .single();

    if (error) throw error;
    return newConv.id;
  } else {
    // Coach/admin: contactId is a student or parent profile ID
    const { data: coach } = await supabase
      .from("coaches")
      .select("id")
      .eq("account_id", userId)
      .single();

    if (!coach) throw new Error("Coach record not found for current user.");

    // Determine profile type
    const { data: studentProfile } = await supabase
      .from("students")
      .select("id")
      .eq("id", contactId)
      .maybeSingle();

    const profileType = studentProfile ? "student" : "parent";

    const { data: conv, error } = await supabase
      .from("conversations")
      .upsert(
        {
          coach_id: coach.id,
          profile_id: contactId,
          profile_type: profileType,
        },
        { onConflict: "coach_id,profile_id" },
      )
      .select("id")
      .single();

    if (error) throw error;
    return conv.id;
  }
}
