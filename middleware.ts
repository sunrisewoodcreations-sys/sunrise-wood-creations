import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// This runs on every page request. Its main job is to refresh the login
// session cookie so people stay logged in (Supabase sessions default to a
// long-lived refresh token — this is the piece that quietly renews it in
// the background, which is why nobody gets logged out "randomly").
// It also keeps customers out of /admin and keeps logged-out people out of
// /account and /admin entirely.
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

  if ((isAccountRoute || isAdminRoute) && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", path);
    return NextResponse.redirect(url);
  }

  if (isAdminRoute && user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/account";
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/account/:path*",
    "/admin/:path*"
  ]
};
