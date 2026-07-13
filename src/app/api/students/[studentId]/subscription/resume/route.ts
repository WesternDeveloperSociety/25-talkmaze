import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/src/lib/auth/server/requireRole";
import { resolveStudentIdForBilling } from "@/src/lib/payments/server/resolveStudentIdForBilling";
import { resumeSubscription } from "@/src/lib/payments/server/plan-changes/resumeSubscription";

const ParamsSchema = z.object({ studentId: z.string().uuid() }).strict();

const BodySchema = z.object({}).strict();

/**
 * POST /api/students/[studentId]/subscription/resume
 * Resumes auto-renewal for a subscription that was scheduled to cancel at
 * period end.
 */
export async function POST(
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
  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
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
    const result = await resumeSubscription(supabase, {
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
    console.error("students/[studentId]/subscription/resume POST error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
