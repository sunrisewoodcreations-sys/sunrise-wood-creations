import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// This runs on every page request. Its main job is to refresh the login
// session cookie so people stay logged in (Supabase sessions default to a
// long-lived refresh token — this is the piece that quietly renews it in
// the background, which is why nobody gets logged out "randomly").
// It also keeps customers out of /admin and keeps logged-out people out of
// /account and /admin entirely.
//
// New: Coming Soon mode. When active, every public page is rewritten to
// the Coming Soon page for everyone EXCEPT an authenticated admin — same
// admin check already used below for /admin routes, reused rather than
// duplicated with different logic. /login, /admin, and /api are always
// left alone: /login has to stay reachable or there'd be no way to ever
// become an authenticated admin in the first place; /admin already has
// its own real auth gate right below; /api routes are left to function
// normally since nothing on a gated page can call them anyway.
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        }
      }
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;

  const isAccountRoute = path.startsWith("/account");
  const isAdminRoute = path.startsWith("/admin");
  const isLoginRoute = path.startsWith("/login");
  const isComingSoonRoute = path.startsWith("/coming-soon");

  // Existing behavior, completely unchanged.
  if ((isAccountRoute || isAdminRoute) && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", path);
    return NextResponse.redirect(url);
  }

  // Role is looked up once, reused for both the existing admin-route
  // check below and the new Coming Soon bypass — one query, not two,
  // and only ever runs for a logged-in user (an anonymous visitor can
  // never be an admin, so there's nothing to look up for them).
  let role: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    role = profile?.role || null;
  }

  // Existing behavior, completely unchanged.
  if (isAdminRoute && user) {
    if (role !== "admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/account";
      return NextResponse.redirect(url);
    }
  }

  // New: Coming Soon gate. Only reached for paths that aren't /admin,
  // /login, or /coming-soon itself (matcher below also excludes /api
  // and static assets entirely, so this never even runs for those).
  if (!isAdminRoute && !isLoginRoute && !isComingSoonRoute) {
    const { data: settingsRow } = await supabase.from("site_settings").select("data").eq("id", 1).maybeSingle();
    const websiteStatus = (settingsRow?.data as any)?.websiteStatus;

    // Fails open (treats a missing/unreadable setting as "live") rather
    // than closed — a database hiccup here would also break the admin
    // role lookup above in the same way, so failing closed risks
    // locking out the admin too, not just the public.
    const isComingSoon = websiteStatus === "coming_soon";
    const isAuthenticatedAdmin = !!user && role === "admin";

    if (isComingSoon && !isAuthenticatedAdmin) {
      const url = request.nextUrl.clone();
      url.pathname = "/coming-soon";
      return NextResponse.rewrite(url);
    }
  }

  return response;
}

export const config = {
  matcher: [
    // Runs on every page except: API routes, Next.js internals, and
    // common static file extensions. This intentionally broadens the
    // original ["/account/:path*", "/admin/:path*"] matcher, since
    // Coming Soon mode needs to see EVERY public page request, not
    // just those two sections — the account/admin routes are still
    // fully covered by this broader pattern, nothing narrows for them.
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico)$).*)"
  ]
};
