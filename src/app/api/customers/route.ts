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
  const { data: profile } = await supabase.from("profiles").select("role, is_demo_account").eq("id", user?.id).single();

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }
  const isDemo = !!profile?.is_demo_account;

  const { fullName, email } = await req.json();

  if (!fullName?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const admin = createAdminClient();

  // The demo account is never allowed down the real-invite path below,
  // no matter what email it enters — Supabase's invite system sends a
  // real email through a completely separate mechanism from the rest
  // of this app's email sending, one that the demo-mode safety wrapper
  // has no visibility into. Forcing every demo customer through the
  // no-account placeholder path is the only way to guarantee a demo
  // action can never actually invite a real address.
  if (!email?.trim() || isDemo) {
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
        // For demo customers specifically: has_real_email is set true
        // and notifications stay on, even though the address itself
        // is a fake placeholder. That flag is what other parts of the
        // app check before attempting to send a notification email at
        // all — leaving it false silently blocked every send before
        // it ever reached the safe interception system, so no demo
        // email ever got attempted or logged. The actual safety
        // guarantee here doesn't come from this flag anyway — it
        // comes from the demo account being forced down this whole
        // placeholder-email path in the first place, which already
        // fully prevents a real Supabase invite from ever going out.
        has_real_email: isDemo ? true : false,
        notify_order_updates: isDemo ? true : false,
        notify_invoices: isDemo ? true : false,
        notify_proofs: isDemo ? true : false,
        notify_messages: isDemo ? true : false,
        is_demo: isDemo
      }, { onConflict: "id" });

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      demoNote: isDemo ? "Demo customers never receive a real invite email, even if you enter one — this test customer has no working login, matching every other demo record. Regular notification emails (order updates, etc.) will still be safely intercepted and logged." : undefined
    });
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
