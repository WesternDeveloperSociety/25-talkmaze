"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/src/services/supabase/server";

/**
 * Verifies a password-recovery email token and establishes a session, then
 * sends the user on to /reset-password.
 *
 * This runs only when the user submits the /auth/confirm interstitial form (a
 * POST). 
 */
export async function confirmRecovery(formData: FormData) {
  const token_hash = formData.get("token_hash");

  if (typeof token_hash !== "string" || !token_hash) {
    // `redirect` returns `never`, which narrows token_hash to string below.
    redirect("/auth/confirm?error=invalid_link");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    type: "recovery",
    token_hash,
  });

  if (error) {
    // Re-render the interstitial in its error state (token spent/expired).
    redirect("/auth/confirm?error=expired_link");
  }

  // Session cookies were written by createClient()'s setAll. Forward the user.
  redirect("/reset-password");
}
