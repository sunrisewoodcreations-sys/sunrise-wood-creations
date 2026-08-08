import { createBrowserClient } from "@supabase/ssr";

// Used inside "use client" components — logging in, checking session, etc.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
