import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/src/lib/auth/server/requireRole";
import { approvePendingBookedSlot } from "@/src/lib/scheduling/server/matchmaking";

const ParamsSchema = z.object({ id: z.string().uuid() }).strict();

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRole([3]);
  if (auth instanceof NextResponse) return auth;

  const parsed = ParamsSchema.safeParse(await params);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request parameters", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const result = await approvePendingBookedSlot(parsed.data.id);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error ?? "Failed to approve pending booking" },
        { status: result.status ?? 500 },
      );
    }

    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error("booked-slots approve error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
