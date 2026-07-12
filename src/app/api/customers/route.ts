import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

function randomPassword() {
  return Array.from({ length: 24 }, () => Math.random().toString(36)[2] || "x").join("");
}

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user?.id).single();

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { fullName, email } = await req.json();

  if (!fullName?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const admin = createAdminClient();

  // --- No email given: create a record with no real account at all. ---
  // The database requires every profile to have a real, unique email, so
  // we generate a private placeholder that's never shown or emailed —
  // this customer simply never gets an invite and can never log in.
  if (!email?.trim()) {
    const placeholderEmail = `no-email-${randomUUID()}@no-account.sunrisewoodcreations.internal`;

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: placeholderEmail,
      email_confirm: true,
      password: randomPassword(),
      user_metadata: { full_name: fullName.trim() }
    });

    if (createError || !created?.user) {
      return NextResponse.json({ error: createError?.message || "Couldn't create this customer" }, { status: 400 });
    }

    const { error: profileError } = await admin
      .from("profiles")
      .upsert({
        id: created.user.id,
        full_name: fullName.trim(),
        email: placeholderEmail,
        role: "customer",
        has_real_email: false,
        notify_order_updates: false,
        notify_invoices: false,
        notify_proofs: false,
        notify_messages: false
      }, { onConflict: "id" });

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  }

  // --- Real email given: normal invite flow, plus notification prefs. ---
  const { error: gateError } = await admin
    .from("allowed_emails")
    .upsert({ email: email.trim().toLowerCase(), full_name: fullName.trim() });

  if (gateError) {
    return NextResponse.json({ error: gateError.message }, { status: 400 });
  }

  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(email.trim().toLowerCase(), {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/update-password`
  });

  if (inviteError) {
    return NextResponse.json({ error: inviteError.message }, { status: 400 });
  }

  // The invite creates the auth user (and, via our handle_new_user()
  // trigger, their profile). Mark that this is a real, working email —
  // notification preferences stay at their defaults (all on) until the
  // customer sets their own from their account.
  const { data: matchedUsers } = await admin.auth.admin.listUsers();
  const match = matchedUsers?.users.find(u => u.email?.toLowerCase() === email.trim().toLowerCase());
  if (match) {
    await admin.from("profiles").update({ has_real_email: true }).eq("id", match.id);
  }

  return NextResponse.json({ ok: true });
}
