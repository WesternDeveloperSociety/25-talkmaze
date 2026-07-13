import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/src/lib/auth/server/requireRole";
import { listSessionsForCoach } from "@/src/lib/scheduling/server/listSessionsForCoach";
import { listSessionsForParent } from "@/src/lib/scheduling/server/listSessionsForParent";

const QuerySchema = z
  .object({
    student_id: z.string().uuid().optional(),
  })
  .strict();

/**
 * Lists sessions. Role-dispatched — each leg keeps the scoping (and the
 * response DTO) of the audience route it replaced:
 *
 * - Coach (2): only sessions assigned to the calling coach. Optional
 *   `?student_id=` filter — implicit scoping via the coach_id filter (see
 *   docs/api-ownership.md scope discussion: soft-fail with empty list when
 *   the student belongs to a different coach, no information leak). Query
 *   params are validated on this leg only.
 * - Parent (1): every session belonging to the calling account's students,
 *   with the coach relation folded in. Query params are ignored (as before
 *   the audience-route merge).
 */
export async function GET(req: Request) {
  // Stage 1: AUTH
  const auth = await requireRole([1, 2]);
  if (auth instanceof NextResponse) return auth;
  const { account, supabase, user } = auth;

  try {
    switch (account.role) {
      case 2: {
        // Stage 2: VALIDATE (coach leg only)
        const parsed = QuerySchema.safeParse(
          Object.fromEntries(new URL(req.url).searchParams),
        );
        if (!parsed.success) {
          return NextResponse.json(
            {
              error: "Invalid request parameters",
              details: parsed.error.flatten(),
            },
            { status: 400 },
          );
        }

        // Stage 3: AUTHORIZE — implicit scoping inside the helper.
        // Stage 4: EXECUTE
        const result = await listSessionsForCoach(
          supabase,
          user.id,
          parsed.data.student_id,
        );
        if (!result.ok) {
          return NextResponse.json(
            { error: result.error },
            { status: result.status },
          );
        }
        return NextResponse.json({ sessions: result.sessions });
      }
      default: {
        // Stage 4: EXECUTE (parent leg — the account_id scoping is the
        // authorization)
        const result = await listSessionsForParent(supabase, user.id);
        if (!result.ok) {
          return NextResponse.json(
            { error: result.error },
            { status: result.status },
          );
        }
        return NextResponse.json({ sessions: result.sessions });
      }
    }
  } catch (err: unknown) {
    console.error("sessions GET error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
