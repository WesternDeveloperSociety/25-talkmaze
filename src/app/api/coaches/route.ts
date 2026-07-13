import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { requireRole } from "@/src/lib/auth/server/requireRole";

const BodySchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(6),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
  })
  .strict();

export async function GET() {
  const auth = await requireRole([3]);
  if (auth instanceof NextResponse) return auth;
  const { supabase } = auth;

  try {
    const { data, error } = await supabase
      .from("coaches")
      .select("id, account_id, first_name, last_name, avatar_url, created_at");

    if (error) {
      console.error("coaches GET error", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }

    return NextResponse.json({ employees: data ?? [] });
  } catch (err: unknown) {
    console.error("coaches GET error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  // Stage 1: AUTH (above the try/catch, no manual getUser+role-check shape).
  const auth = await requireRole([3]);
  if (auth instanceof NextResponse) return auth;
  const { supabase } = auth;

  // Stage 2: VALIDATE
  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { email, password, firstName, lastName } = parsed.data;

  // Stage 4: EXECUTE
  try {
    // A separate client so we don't overwrite the admin's own session cookies.
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
      console.error("coaches POST auth error", authError);
      return NextResponse.json(
        { error: "Failed to create coach account" },
        { status: 400 },
      );
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: "Failed to create coach account" },
        { status: 500 },
      );
    }

    const { error: accountError } = await supabase
      .from("account")
      .insert({ id: authData.user.id, email, role: 2 });

    if (accountError) {
      console.error("coaches POST account insert error", accountError);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }

    const { error: coachError } = await supabase.from("coaches").insert({
      account_id: authData.user.id,
      first_name: firstName,
      last_name: lastName,
    });

    if (coachError) {
      console.error("coaches POST coach insert error", coachError);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      coach: {
        id: authData.user.id,
        email: authData.user.email,
        name: `${firstName} ${lastName}`.trim(),
      },
    });
  } catch (err: unknown) {
    console.error("coaches POST error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
