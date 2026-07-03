import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/src/lib/auth/server/requireRole";
import { resolveStudentIdForBilling } from "@/src/lib/payments/server/resolveStudentIdForBilling";
import { cancelSubscription } from "@/src/lib/payments/server/plan-changes/cancelSubscription";

const BodySchema = z
  .object({
    studentId: z.string().uuid(),
    refund: z.boolean().optional(),
  })
  .strict();

/**
 * POST /api/subscriptions/cancel
 * Cancels the active student subscription both in Stripe and in Supabase.
 * When refund=true, issues a full refund and immediately cancels (within 28-day window only).
 * When refund=false (default), sets cancel_at_period_end=true so access continues until period end.
 */
export async function POST(req: Request) {
  // Stage 1: AUTH
  const auth = await requireRole([1]);
  if (auth instanceof NextResponse) return auth;
  const { user, supabase } = auth;

  // Stage 2: VALIDATE
  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const requestRefund: boolean = parsed.data.refund === true;

  // Stage 3: AUTHORIZE (ownership)
  const studentResolution = await resolveStudentIdForBilling({
    supabase,
    accountId: user.id,
    requestedStudentId: parsed.data.studentId,
    errors: {
      studentNotFound: { error: "Forbidden", status: 403 },
      noActiveStudentProfile: {
        error: "No active student profile",
        status: 400,
      },
    },
  });

  if (!studentResolution.ok) {
    return NextResponse.json(
      { error: studentResolution.error },
      { status: studentResolution.status },
    );
  }

  // Stage 4: EXECUTE
  try {
    const result = await cancelSubscription(supabase, {
      accountId: user.id,
      studentId: studentResolution.studentId,
      refund: requestRefund,
    });
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("cancel error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
