import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/src/lib/auth/server/requireRole";

const BodySchema = z
  .object({
    phoneNumber: z.string().min(1),
    pin: z.string().min(1),
  })
  .strict();

/**
 * PATCH /api/parents/setup
 * Updates the parent's phone number and PIN after account creation.
 */
export async function PATCH(req: Request) {
  const auth = await requireRole([1]);
  if (auth instanceof NextResponse) return auth;
  const { supabase, user } = auth;

  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const { error: updateError } = await supabase
      .from("parents")
      .update({
        phone_number: parsed.data.phoneNumber,
        profile_access_pin: parsed.data.pin,
      })
      .eq("account_id", user.id);
    if (updateError) {
      console.error("parents/setup update error", updateError);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }
    await supabase.from("account").update({ new: false }).eq("id", user.id);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("parents/setup error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
