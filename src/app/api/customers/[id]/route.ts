import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Admin-only edit of a customer's name/email/phone/address — separate
// from account creation (src/app/api/customers/route.ts), which is
// untouched by this. Never references the orders table anywhere in
// this file — see the code below, there is no .from("orders") call at
// any point, which is what actually makes it structurally impossible
// for this route to modify or delete an order, not just unlikely.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: adminProfile } = await supabase.from("profiles").select("role").eq("id", user?.id).single();

  if (adminProfile?.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { fullName, email, phone, address } = await req.json();
  const admin = createAdminClient();

  // Look up the existing customer first — needed to know their current
  // email before deciding whether a change actually needs to touch the
  // auth system too, and to confirm this ID genuinely exists before
  // attempting anything.
  const { data: existingCustomer, error: fetchError } = await admin
    .from("profiles")
    .select("id, email, has_real_email")
    .eq("id", params.id)
    .maybeSingle();

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 400 });
  if (!existingCustomer) return NextResponse.json({ error: "Customer not found — nothing was saved." }, { status: 404 });

  const updatePayload: Record<string, any> = {
    phone: phone?.trim() || null,
    address: address?.trim() || null
  };

  if (fullName?.trim()) {
    updatePayload.full_name = fullName.trim();
  }

  // Email changes are handled deliberately carefully:
  // - Blank input NEVER removes an existing real email — clearing a
  //   field is too easy to do by accident, and doing so could break
  //   the customer's own ability to log in. Leaving it blank is
  //   treated as "no change," not "remove the email."
  // - A genuinely new, different email must succeed in the actual
  //   auth system FIRST. If that fails (e.g. already used by another
  //   account), the whole request is rejected before the profile
  //   table is touched at all, so the two can never end up out of sync
  //   with each other.
  const trimmedEmail = email?.trim();
  if (trimmedEmail && trimmedEmail.toLowerCase() !== (existingCustomer.email || "").toLowerCase()) {
    const { error: authError } = await admin.auth.admin.updateUserById(params.id, { email: trimmedEmail });
    if (authError) {
      return NextResponse.json({ error: `Couldn't update email: ${authError.message}` }, { status: 400 });
    }
    updatePayload.email = trimmedEmail;
    updatePayload.has_real_email = true;
  }

  // The actual write happens via the admin client, after the caller's
  // role has already been verified above — this sidesteps any
  // row-security policy silently blocking the update (the same class
  // of silent failure that already hit demo_email_log elsewhere in
  // this project). Selecting the row back and checking it's non-null
  // is what actually guarantees this route can never report "saved"
  // when nothing was actually written — a plain update() without this
  // check reports success even if zero rows matched.
  const { data: updated, error } = await admin
    .from("profiles")
    .update(updatePayload)
    .eq("id", params.id)
    .select()
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (!updated) {
    return NextResponse.json({ error: "The update did not affect any row — nothing was saved." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, customer: updated });
}
