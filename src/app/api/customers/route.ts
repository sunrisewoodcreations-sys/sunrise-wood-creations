import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user?.id).single();

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { fullName, email } = await req.json();
  if (!fullName?.trim() || !email?.trim()) {
    return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Step 1: open the gate — this email is now allowed to have an account.
  const { error: gateError } = await admin
    .from("allowed_emails")
    .upsert({ email: email.trim().toLowerCase(), full_name: fullName.trim() });

  if (gateError) {
    return NextResponse.json({ error: gateError.message }, { status: 400 });
  }

  // Step 2: send the "set up your account" email via Supabase Auth's
  // built-in invite flow. This creates the auth user (which triggers our
  // handle_new_user() database function to build their profile) and emails
  // them a secure link that lands on /update-password.
  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(email.trim().toLowerCase(), {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/update-password`
  });

  if (inviteError) {
    return NextResponse.json({ error: inviteError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
