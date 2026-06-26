import { updateSession } from "@/src/lib/auth/server/middleware/updateSession";
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Order:
 *   1. updateSession refreshes auth cookies + handles the public/private gate
 *      (sends unauthed users to /login except on whitelisted pages, sends
 *      authed users away from /login).
 *   2. Webhooks bypass everything below.
 *   3. Authed users on public-auth pages (/signup, /forgot-password, /)
 *      redirected to their dashboard. /reset-password is the exception: an
 *      authenticated session lands there straight from the email link.
 *   4. RBAC: coaches/admins routed away from /profiles to their dashboard;
 *      non-coaches kicked off /coach; non-admins kicked off /admin.
 *   5. Profile-locked routes: regular users without an active profile cookie
 *      are routed to /profiles. /profiles, /onboarding, /payments, and
 *      /reset-password are carved out (reachable without a profile cookie).
 *   6. Profile-type gate: student profiles stay under /student; parent
 *      profiles stay under /parent.
 *   7. Subscription gate: student profile without active subscription
 *      /payments.
 */
export async function middleware(request: NextRequest) {
  const response = await updateSession(request);

  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/api/webhooks/stripe") ||
    pathname.startsWith("/api/webhooks/lessonspace")
  ) {
    return NextResponse.next();
  }

  // Routes that are intentionally public to loggedin users too: /reset-password
  // and /auth/confirm can be opened from a Supabase email link while a session
  // is already active, and /api / /_next are framework internals.
  const isProfileLockedRoute =
    !pathname.startsWith("/login") &&
    !pathname.startsWith("/signup") &&
    !pathname.startsWith("/forgot-password") &&
    !pathname.startsWith("/reset-password") &&
    !pathname.startsWith("/auth") &&
    !pathname.startsWith("/payments") &&
    !pathname.startsWith("/profiles") &&
    !pathname.startsWith("/onboarding") &&
    !pathname.startsWith("/api") &&
    !pathname.startsWith("/_next") &&
    pathname !== "/";
  const isParentRoute =
    pathname === "/parent" || pathname.startsWith("/parent/");
  const isStudentRoute =
    pathname === "/student" || pathname.startsWith("/student/");

  // Create Supabase client (used by all subsequent role/profile checks).
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {
          // No-op: cookies are handled by updateSession.
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let role: number | undefined;
  if (user) {
    const { data: account } = await supabase
      .from("account")
      .select("role")
      .eq("id", user.id)
      .single();
    role = account?.role ?? undefined;
  }

  const isRegularUser = role === 1;
  const isCoach = role === 2;
  const isAdmin = role === 3;

  // Authed users on public-auth pages (/signup, /forgot-password, /) → dashboard.
  // /reset-password is intentionally excluded - authenticated users may land
  // here via a Supabase email link.
  const isPublicAuthPage =
    pathname === "/" ||
    pathname === "/signup" ||
    pathname.startsWith("/forgot-password");

  if (user && isPublicAuthPage) {
    const url = request.nextUrl.clone();
    if (isCoach) url.pathname = "/coach";
    else if (isAdmin) url.pathname = "/admin";
    else url.pathname = "/profiles";
    return NextResponse.redirect(url);
  }

  // RBAC on /profiles, /coach, /admin.
  if (user) {
    if (pathname.startsWith("/profiles") && (isCoach || isAdmin)) {
      const url = request.nextUrl.clone();
      url.pathname = isCoach ? "/coach" : "/admin";
      return NextResponse.redirect(url);
    }

    // Coaches message from their own dashboard route. Send them off the family
    // `/message` surface to `/coach/message`, preserving any conversation id.
    if (isCoach && pathname.startsWith("/message")) {
      const url = request.nextUrl.clone();
      url.pathname = pathname.replace(/^\/message/, "/coach/message");
      return NextResponse.redirect(url);
    }

    if (pathname.startsWith("/coach") && !isCoach) {
      const url = request.nextUrl.clone();
      url.pathname = "/student";
      return NextResponse.redirect(url);
    }

    if (pathname.startsWith("/admin") && !isAdmin) {
      const url = request.nextUrl.clone();
      url.pathname = "/student";
      return NextResponse.redirect(url);
    }
  }

  // Profile cookie gate (regular users only, on profile-locked routes).
  if (user && isRegularUser && isProfileLockedRoute) {
    const activeProfileId = request.cookies.get("active_profile_id")?.value;
    const activeProfileType = request.cookies.get("active_profile_type")?.value;

    if (!activeProfileId) {
      const url = request.nextUrl.clone();
      url.pathname = "/profiles";
      return NextResponse.redirect(url);
    }

    // Active profile type must match the family route namespace.
    if (activeProfileType === "student" && isParentRoute) {
      const url = request.nextUrl.clone();
      url.pathname = "/student";
      return NextResponse.redirect(url);
    }

    if (activeProfileType === "parent" && isStudentRoute) {
      const url = request.nextUrl.clone();
      url.pathname = "/parent";
      return NextResponse.redirect(url);
    }

    // Subscription gate for student profiles on /student/**.
    if (activeProfileType === "student" && isStudentRoute) {
      const { data: subscriptions } = await supabase
        .from("student_subscriptions")
        .select("id")
        .eq("student_id", activeProfileId)
        .eq("status", "active")
        .limit(1);

      if (!subscriptions || subscriptions.length === 0) {
        const url = request.nextUrl.clone();
        url.pathname = "/payments";
        return NextResponse.redirect(url);
      }
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
