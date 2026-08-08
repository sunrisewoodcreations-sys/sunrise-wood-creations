import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { EmailOtpType } from "@supabase/supabase-js";

// A magic link from Supabase doesn't establish a session by itself —
// it redirects here with a token that must be verified server-side,
// which is what actually sets the session cookie. This route didn't
// exist before (this app's only prior sign-in path was a typed
// password, handled entirely client-side), so it's new — required for
// the demo account's one-click login link to actually log anyone in,
// not a change to how normal password login works.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") || "/admin";

  if (token_hash && type) {
    const cookieStore = cookies();
    const response = NextResponse.redirect(new URL(next, req.url));

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          }
        }
      }
    );

    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) return response;
  }

  return NextResponse.redirect(new URL("/login?error=invalid_link", req.url));
}
