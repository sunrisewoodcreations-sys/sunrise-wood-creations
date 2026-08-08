import { createClient } from "@/lib/supabase/server";

// Checks the CURRENT request's own logged-in session — safely callable
// from any server component or route in the same request, since
// cookies() (used inside createClient()) is request-scoped in Next.js.
// This is the exact same check email.ts's sendViaResend() already does
// internally for email interception; this is the same logic made
// reusable for admin pages that need to filter data by demo status,
// not a second, different way of detecting the demo account.
export async function isDemoAccountRequest(): Promise<boolean> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const { data: profile } = await supabase.from("profiles").select("is_demo_account").eq("id", user.id).maybeSingle();
    return !!profile?.is_demo_account;
  } catch {
    return false;
  }
}
