import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// One-time (idempotent) setup — creates the single special demo admin
// account if it doesn't already exist. A real Supabase user, with a
// random password nobody ever needs to know or use, since access is
// always via a freshly-generated magic link, never a typed password.
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: adminProfile } = await supabase.from("profiles").select("role, is_demo_account").eq("id", user?.id).single();

  if (adminProfile?.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }
  if (adminProfile?.is_demo_account) {
    return NextResponse.json({ error: "The demo account itself cannot create another demo account." }, { status: 403 });
  }

  const admin = createAdminClient();

  const { data: existing } = await admin.from("profiles").select("id").eq("is_demo_account", true).maybeSingle();
  if (existing) {
    return NextResponse.json({ ok: true, alreadyExists: true });
  }

  const demoEmail = process.env.DEMO_ACCOUNT_EMAIL || "demo-tester@sunrisewoodcreations.internal";
  const randomPassword = require("crypto").randomBytes(32).toString("hex"); // never used or shown — access is always via magic link

  const { data: newUser, error: createError } = await admin.auth.admin.createUser({
    email: demoEmail,
    password: randomPassword,
    email_confirm: true
  });
  if (createError || !newUser.user) {
    return NextResponse.json({ error: createError?.message || "Couldn't create the demo account." }, { status: 500 });
  }

  const { error: profileError } = await admin.from("profiles").upsert({
    id: newUser.user.id,
    email: demoEmail,
    full_name: "Demo Tester",
    role: "admin",
    is_demo_account: true
  });
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });

  return NextResponse.json({ ok: true, alreadyExists: false });
}
