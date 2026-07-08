import { createClient } from "@supabase/supabase-js";

// DANGER: this client bypasses all security rules. It uses the "service role"
// key, which must never be exposed to the browser (note it's NOT prefixed
// with NEXT_PUBLIC_). Only ever import this file inside API routes /
// server-only code, never inside a "use client" component.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
