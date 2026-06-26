"use server";

import { createClient } from "@/src/services/supabase/server";

/**
 * Sends a password reset email to the user via Supabase Auth.
 *
 * The email link's origin and path come from the Supabase "Reset Password"
 * template:
 * (`{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery`),
 * so no `redirectTo` is needed here.
 *
 * @param email The email address of the user.
 */
export async function sendResetEmail(email: string) {
  const supabase = await createClient();

  const { error } = await supabase.auth.resetPasswordForEmail(email);

  if (error) {
    console.error("Error sending reset email:", error.message);
    return { success: false, error: error.message };
  }

  return { success: true };
}
