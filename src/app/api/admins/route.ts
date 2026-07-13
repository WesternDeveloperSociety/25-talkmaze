import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { requireRole } from "@/src/lib/auth/server/requireRole";

const BodySchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(6),
    name: z.string().min(1),
  })
  .strict();

export async function POST(req: Request) {
  const auth = await requireRole([3]);
  if (auth instanceof NextResponse) return auth;
  const { supabase } = auth;

  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { email, password, name } = parsed.data;

  try {
    // Separate client so we don't overwrite the admin's session cookies.
    const authClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      },
    );

    const { data: authData, error: authError } = await authClient.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
      },
    });

    if (authError) {
      console.error("admins POST auth error", authError);
      return NextResponse.json(
        { error: "Failed to create admin account" },
        { status: 400 },
      );
    }
    if (!authData.user) {
      return NextResponse.json(
        { error: "Failed to create admin account" },
        { status: 500 },
      );
    }

    const { error: accountError } = await supabase
      .from("account")
      .update({ role: 3 })
      .eq("id", authData.user.id);

    if (accountError) {
      console.error("admins POST account update error", accountError);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      admin: {
        id: authData.user.id,
        email: authData.user.email,
        name,
      },
    });
  } catch (err: unknown) {
    console.error("admins POST error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
