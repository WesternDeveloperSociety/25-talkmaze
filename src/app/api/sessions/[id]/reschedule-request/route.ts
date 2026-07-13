import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/src/lib/auth/server/requireRole";
import { assertOwnsStudent } from "@/src/lib/auth/server/ownership";
import { createRescheduleRequestBodySchema } from "@/src/lib/scheduling/schemas";
import { createRescheduleRequest } from "@/src/lib/scheduling/server/createRescheduleRequest";
import { withdrawRescheduleRequest } from "@/src/lib/scheduling/server/withdrawRescheduleRequest";

const ParamsSchema = z
  .object({ id: z.coerce.number().int().positive() })
  .strict();

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // Stage 1: AUTH
  const auth = await requireRole([1]);
  if (auth instanceof NextResponse) return auth;
  const { supabase } = auth;

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
  const parsedBody = createRescheduleRequestBodySchema.safeParse(
    await req.json().catch(() => ({})),
  );
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsedBody.error.flatten() },
      { status: 400 },
    );
  }

  // Stage 3: AUTHORIZE — look up the session to find its student, then verify
  // the calling parent owns that student. 404 on missing session (parent
  // shouldn't learn about other parents' session IDs).
  const { data: session, error: lookupError } = await supabase
    .from("sessions")
    .select("id, student_id")
    .eq("id", parsedParams.data.id)
    .maybeSingle();
  if (lookupError) {
    console.error("sessions/[id]/reschedule-request lookup error", lookupError);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
  if (!session || !session.student_id) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  const ownership = await assertOwnsStudent(auth, session.student_id);
  if (ownership instanceof NextResponse) return ownership;

  // Stage 4: EXECUTE
  const result = await createRescheduleRequest(supabase, {
    sessionId: parsedParams.data.id,
    requestedStartTime: parsedBody.data.requested_start_time,
    requestedEndTime: parsedBody.data.requested_end_time,
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status },
    );
  }
  return NextResponse.json({ success: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRole([1]);
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

  const { data: session, error: lookupError } = await supabase
    .from("sessions")
    .select("id, student_id")
    .eq("id", parsedParams.data.id)
    .maybeSingle();
  if (lookupError) {
    console.error("sessions/[id]/reschedule-request lookup error", lookupError);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
  if (!session || !session.student_id) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  const ownership = await assertOwnsStudent(auth, session.student_id);
  if (ownership instanceof NextResponse) return ownership;

  const result = await withdrawRescheduleRequest(
    supabase,
    parsedParams.data.id,
  );
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status },
    );
  }
  return NextResponse.json({ success: true });
}
