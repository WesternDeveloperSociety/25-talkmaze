import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/src/lib/auth/server/requireRole";
import { assertCoachOwnsSession } from "@/src/lib/auth/server/ownership";
import { declineRescheduleRequest } from "@/src/lib/scheduling/server/declineRescheduleRequest";

const ParamsSchema = z
  .object({ id: z.coerce.number().int().positive() })
  .strict();

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRole([2]);
  if (auth instanceof NextResponse) return auth;
  const { supabase } = auth;

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

  const ownership = await assertCoachOwnsSession(auth, parsedParams.data.id);
  if (ownership instanceof NextResponse) return ownership;

  const result = await declineRescheduleRequest(supabase, parsedParams.data.id);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status },
    );
  }
  return NextResponse.json({ success: true });
}
