import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Sets (or resets) a real, known password on the existing demo
// account so it can log in through the normal /login page instead of
// only via a one-time magic link. This changes nothing about how
// isolation or email interception work — both already key off
// is_demo_account on the logged-in session, which is identical no
// matter how that session was established. Callable by a real admin
// only (never the demo account itself), same authorization pattern as
// every other action on this page.
function generateStrongPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
  let pass = "";
  const bytes = require("crypto").randomBytes(20);
  for (let i = 0; i < 20; i++) pass += chars[bytes[i] % chars.length];
  return pass;
}

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: adminProfile } = await supabase.from("profiles").select("role, is_demo_account").eq("id", user?.id).single();

  if (adminProfile?.role !== "admin" || adminProfile?.is_demo_account) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: demoProfile } = await admin.from("profiles").select("id, email").eq("is_demo_account", true).maybeSingle();
  if (!demoProfile) {
    return NextResponse.json({ error: "No demo account exists yet — set one up first." }, { status: 400 });
  }

  const newPassword = generateStrongPassword();
  const { error } = await admin.auth.admin.updateUserById(demoProfile.id, { password: newPassword });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, email: demoProfile.email, password: newPassword });
}
