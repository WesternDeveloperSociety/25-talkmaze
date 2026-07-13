import { NextResponse } from "next/server";
import { requireRole } from "@/src/lib/auth/server/requireRole";

export async function GET() {
  const auth = await requireRole([]);
  if (auth instanceof NextResponse) return auth;

  return NextResponse.json({
    role: auth.account.role,
    userId: auth.user.id,
  });
}
