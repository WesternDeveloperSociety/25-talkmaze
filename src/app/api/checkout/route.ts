import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/src/lib/auth/server/requireRole";
import { assertOwnsStudent } from "@/src/lib/auth/server/ownership";
import { startAuthedCheckout } from "@/src/lib/payments/server/startAuthedCheckout";
import { startSignupCheckout } from "@/src/lib/payments/server/startSignupCheckout";

/**
 * POST /api/checkout
 *
 * Two flows controlled by `studentId`:
 *   - `studentId === "new"` → public sub-flow (signup + first payment).
 *     Anonymous callers are allowed by design (docs/api-auth.md:194-218).
 *   - `studentId !== "new"` → authed flow: requireRole([1]) + assertOwnsStudent.
 *
 * NOTE on stage ordering: validation runs BEFORE auth here because the auth
 * branch depends on `studentId`. This is the documented checkout exception
 * (docs/api-auth.md §"The /api/checkout exception"). The public branch is
 * intentional, not accidental.
 *
 * Stripe/Supabase orchestration lives in src/lib/payments/server/ — this
 * handler is the auth/validate/authorize/delegate skeleton.
 */

const BodySchema = z
  .object({
    priceId: z.string().min(1),
    studentId: z.union([z.literal("new"), z.string().uuid()]),
    // Signup-only fields. Optional - only meaningful when studentId === "new".
    pFName: z.string().optional(),
    pLName: z.string().optional(),
    sFName: z.string().optional(),
    sLName: z.string().optional(),
    email: z.string().email().optional(),
    password: z.string().optional(),
  })
  .strict();

export async function POST(request: Request) {
  const parsed = BodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid request body",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }
  const data = parsed.data;

  try {
    if (data.studentId !== "new") {
      // Authed flow: role gate + ownership BEFORE any Stripe work.
      const auth = await requireRole([1]);
      if (auth instanceof NextResponse) return auth;

      const ownership = await assertOwnsStudent(auth, data.studentId);
      if (ownership instanceof NextResponse) return ownership;

      const result = await startAuthedCheckout(auth.supabase, {
        accountId: auth.user.id,
        userEmail: auth.user.email ?? null,
        studentId: data.studentId,
        priceId: data.priceId,
      });
      if (!result.ok) {
        return NextResponse.json(
          { error: result.error },
          { status: result.status },
        );
      }
      return NextResponse.json({
        clientSecret: result.clientSecret,
        subscriptionId: result.subscriptionId,
        prefill: result.prefill,
      });
    }

    // Public signup flow.
    const result = await startSignupCheckout({
      email: data.email ?? null,
      priceId: data.priceId,
    });
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }
    return NextResponse.json({
      clientSecret: result.clientSecret,
      subscriptionId: result.subscriptionId,
      prefill: result.prefill,
    });
  } catch (err: unknown) {
    console.error("checkout error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
