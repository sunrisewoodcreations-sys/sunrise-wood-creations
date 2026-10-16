import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

function randomPassword() {
  return Array.from({ length: 24 }, () => Math.random().toString(36)[2] || "x").join("");
}

// Turns a lead into a regular customer (no email or login needed, the same
// kind of customer "Add a new customer" makes when you leave email blank),
// and links the two. The browser then sends you to that customer's page,
// where the normal "Add order" button is. Admin only.
//
// If a customer with the same name AND phone already exists, nothing is
// created until you choose: use that existing customer, or create a new
// one anyway.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("role, is_demo_account").eq("id", user?.id).single();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }
  const isDemo = !!profile?.is_demo_account;

  const body = await req.json().catch(() => ({}));
  const confirmDuplicate = body.confirmDuplicate === true;
  const useExistingCustomerId = typeof body.useExistingCustomerId === "string" ? body.useExistingCustomerId : "";

  const admin = createAdminClient();
  const { data: lead } = await admin.from("leads").select("*").eq("id", params.id).maybeSingle();
  if (!lead || lead.is_demo !== isDemo) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  // Already turned into a customer: just go there. Never creates a second one.
  if (lead.customer_id) {
    return NextResponse.json({ ok: true, customerId: lead.customer_id, alreadyLinked: true });
  }

  // Chose to use a customer that already exists.
  if (useExistingCustomerId) {
    const { data: existing } = await admin
      .from("profiles")
      .select("id, role, is_demo")
      .eq("id", useExistingCustomerId)
      .maybeSingle();
    if (!existing || existing.role !== "customer" || existing.is_demo !== isDemo) {
      return NextResponse.json({ error: "That customer wasn't found" }, { status: 404 });
    }
    await admin.from("leads").update({ customer_id: existing.id }).eq("id", lead.id);
    return NextResponse.json({ ok: true, customerId: existing.id });
  }

  // Same name + same phone as an existing customer is a strong sign it is
  // the same person. Ask first; never decide for you.
  if (!confirmDuplicate && lead.phone?.trim()) {
    const { data: sameName } = await admin
      .from("profiles")
      .select("id, full_name, phone")
      .eq("role", "customer")
      .eq("is_demo", isDemo)
      .eq("phone", lead.phone.trim());
    const match = (sameName || []).find(
      (c: any) => (c.full_name || "").trim().toLowerCase() === lead.full_name.trim().toLowerCase()
    );
    if (match) {
      return NextResponse.json({
        possibleDuplicate: true,
        existingCustomerId: match.id,
        existingCustomerName: match.full_name
      });
    }
  }

  // Create the customer the same way "Add a new customer" does when no
  // email is given: a placeholder address, no real login, no emails sent.
  const placeholderEmail = `no-email-${randomUUID()}@no-account.sunrisewoodcreations.internal`;
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: placeholderEmail,
    email_confirm: true,
    password: randomPassword(),
    user_metadata: { full_name: lead.full_name }
  });
  if (createError || !created?.user) {
    return NextResponse.json({ error: createError?.message || "Couldn't create this customer" }, { status: 400 });
  }

  const { error: profileError } = await admin
    .from("profiles")
    .upsert({
      id: created.user.id,
      full_name: lead.full_name,
      email: placeholderEmail,
      phone: lead.phone?.trim() || null,
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

  await admin.from("leads").update({ customer_id: created.user.id }).eq("id", lead.id);
  return NextResponse.json({ ok: true, customerId: created.user.id });
}
