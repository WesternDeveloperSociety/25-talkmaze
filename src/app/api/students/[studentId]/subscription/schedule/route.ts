import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/src/lib/auth/server/requireRole";
import { resolveStudentIdForBilling } from "@/src/lib/payments/server/resolveStudentIdForBilling";
import { scheduleSubscriptionChange } from "@/src/lib/payments/server/plan-changes/scheduleSubscriptionChange";
import { cancelScheduledSubscriptionChange } from "@/src/lib/payments/server/plan-changes/cancelScheduledSubscriptionChange";

const ParamsSchema = z.object({ studentId: z.string().uuid() }).strict();

const PostBodySchema = z
  .object({
    priceId: z.string().min(1),
  })
  .strict();

const DeleteBodySchema = z.object({}).strict();

/**
 * POST /api/students/[studentId]/subscription/schedule
 * Initiates a plan upgrade/downgrade for the student's subscription.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ studentId: string }> },
) {
  // Stage 1: AUTH
  const auth = await requireRole([1]);
  if (auth instanceof NextResponse) return auth;
  const { user, supabase } = auth;

  // Stage 2: VALIDATE
  const parsedParams = ParamsSchema.safeParse(await params);
  if (!parsedParams.success) {
    return NextResponse.json(
      {
        error: "Invalid request parameters",
        details: parsedParams.error.flatten(),
      },
      { status: 400 },
    );
  }
  const parsed = PostBodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { priceId } = parsed.data;

  // Stage 3: AUTHORIZE (ownership)
  const studentResolution = await resolveStudentIdForBilling({
    supabase,
    accountId: user.id,
    requestedStudentId: parsedParams.data.studentId,
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
    console.error("students/[studentId]/subscription/schedule POST error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/students/[studentId]/subscription/schedule
 * Abandons a pending plan change: clears the pending_* columns and releases
 * the Stripe SubscriptionSchedule.
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ studentId: string }> },
) {
  // Stage 1: AUTH
  const auth = await requireRole([1]);
  if (auth instanceof NextResponse) return auth;
  const { user, supabase } = auth;

  // Stage 2: VALIDATE
  const parsedParams = ParamsSchema.safeParse(await params);
  if (!parsedParams.success) {
    return NextResponse.json(
      {
        error: "Invalid request parameters",
        details: parsedParams.error.flatten(),
      },
      { status: 400 },
    );
  }
  const parsed = DeleteBodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Stage 3: AUTHORIZE (ownership)
  const studentResolution = await resolveStudentIdForBilling({
    supabase,
    accountId: user.id,
    requestedStudentId: parsedParams.data.studentId,
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
    const result = await cancelScheduledSubscriptionChange(supabase, {
      accountId: user.id,
      studentId: studentResolution.studentId,
    });
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error(
      "students/[studentId]/subscription/schedule DELETE error",
      err,
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
