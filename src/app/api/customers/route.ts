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

  const { fullName, email, phone, confirmDuplicate } = await req.json();

  if (!fullName?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const admin = createAdminClient();

  if (!email?.trim() || isDemo) {
    // Duplicate check only applies to no-email customers — a real
    // email is already naturally protected, since Supabase itself
    // rejects a second account with the same address. Deliberately
    // NOT name-alone: two different real people can easily share a
    // name. Name + phone together is a much stronger signal of an
    // actual duplicate, and only fires when both are present and both
    // match an existing no-email customer — never blocks creation
    // outright, just asks for confirmation first.
    if (!confirmDuplicate && phone?.trim()) {
      const normalizedPhone = phone.trim();
      const normalizedName = fullName.trim().toLowerCase();
      const { data: possibleDuplicates } = await admin
        .from("profiles")
        .select("id, full_name, phone")
        .eq("role", "customer")
        .eq("is_demo", isDemo)
        .eq("has_real_email", false)
        .eq("phone", normalizedPhone);

      const match = (possibleDuplicates || []).find((c: any) => (c.full_name || "").trim().toLowerCase() === normalizedName);
      if (match) {
        return NextResponse.json({
          possibleDuplicate: true,
          existingCustomerId: match.id,
          existingCustomerName: match.full_name
        });
      }
    }

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
        phone: phone?.trim() || null,
        role: "customer",
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

  const { data: matchedUsers } = await admin.auth.admin.listUsers();
  const match = matchedUsers?.users.find(u => u.email?.toLowerCase() === email.trim().toLowerCase());
  if (match) {
    const updatePayload: Record<string, any> = { has_real_email: true };
    if (phone?.trim()) updatePayload.phone = phone.trim();
    await admin.from("profiles").update(updatePayload).eq("id", match.id);
  }

  return NextResponse.json({ ok: true });
}
