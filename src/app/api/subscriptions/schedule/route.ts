import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/src/lib/auth/server/requireRole";
import { resolveStudentIdForBilling } from "@/src/lib/payments/server/resolveStudentIdForBilling";
import { scheduleSubscriptionChange } from "@/src/lib/payments/server/plan-changes/scheduleSubscriptionChange";

const BodySchema = z
  .object({
    studentId: z.string().uuid(),
    priceId: z.string().min(1),
  })
  .strict();

export async function POST(request: Request) {
  // Stage 1: AUTH
  const auth = await requireRole([1]);
  if (auth instanceof NextResponse) return auth;
  const { user, supabase } = auth;

  // Stage 2: VALIDATE
  const parsed = BodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { priceId, studentId: studentIdOverride } = parsed.data;

  // Stage 3: AUTHORIZE (ownership)
  const studentResolution = await resolveStudentIdForBilling({
    supabase,
    accountId: user.id,
    requestedStudentId: studentIdOverride,
    requireOwnedActiveProfileStudent: true,
    errors: {
      studentNotFound: { error: "Forbidden", status: 403 },
      noActiveStudentProfile: {
        error: "Select a student profile before upgrading",
        status: 400,
      },
      invalidActiveStudentProfile: {
        error: "Active student profile is invalid",
        status: 403,
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
    const result = await scheduleSubscriptionChange(supabase, {
      accountId: user.id,
      studentId: studentResolution.studentId,
      priceId,
    });
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }
    return NextResponse.json({
      clientSecret: result.clientSecret,
      prefill: result.prefill,
      effectiveDate: result.effectiveDate,
    });
  } catch (err: unknown) {
    console.error("schedule error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
