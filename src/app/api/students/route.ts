import { NextResponse } from "next/server";
import { requireRole } from "@/src/lib/auth/server/requireRole";
import { listStudentsForAdmin } from "@/src/lib/profiles/server/listStudentsForAdmin";
import { listStudentsForCoach } from "@/src/lib/profiles/server/listStudentsForCoach";
import { listStudentsForParent } from "@/src/lib/profiles/server/listStudentsForParent";

/**
 * Lists students. Role-dispatched — each leg keeps the scoping (and the
 * response DTO) of the audience route it replaced:
 *
 * - Admin (3): every student row, unscoped.
 * - Coach (2): only students linked via the coach_students junction.
 * - Parent (1): only the calling account's own students, with subscription
 *   status folded in.
 */
export async function GET() {
  // Stage 1: AUTH
  const auth = await requireRole([1, 2, 3]);
  if (auth instanceof NextResponse) return auth;
  const { account, supabase, user } = auth;

  // Stage 4: EXECUTE (no query params; the per-role scoping is the authorization)
  try {
    switch (account.role) {
      case 3: {
        const result = await listStudentsForAdmin(supabase);
        if (!result.ok) {
          return NextResponse.json(
            { error: result.error },
            { status: result.status },
          );
        }
        return NextResponse.json({ students: result.students });
      }
      case 2: {
        const result = await listStudentsForCoach(supabase, user.id);
        if (!result.ok) {
          return NextResponse.json(
            { error: result.error },
            { status: result.status },
          );
        }
        return NextResponse.json({ students: result.students });
      }
      default: {
        const result = await listStudentsForParent(supabase, user.id);
        if (!result.ok) {
          return NextResponse.json(
            { error: result.error },
            { status: result.status },
          );
        }
        return NextResponse.json({ students: result.students });
      }
    }
  } catch (err: unknown) {
    console.error("students GET error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
