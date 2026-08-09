import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Admin-only edit of a customer's phone/address — separate from account
// creation (src/app/api/customers/route.ts), which is untouched by this.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: adminProfile } = await supabase.from("profiles").select("role").eq("id", user?.id).single();

  if (adminProfile?.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { phone, address } = await req.json();

  // The actual write uses the admin client — the caller's role has
  // already been verified above, so this is safe, and it sidesteps
  // any row-security policy silently blocking an admin from editing a
  // customer's row (this exact silent-failure pattern already hit
  // demo_email_log elsewhere in this project). Selecting the updated
  // row back confirms a row was genuinely changed, rather than
  // reporting success on a write that didn't actually happen.
  const admin = createAdminClient();
  const { data: updated, error } = await admin
    .from("profiles")
    .update({
      phone: phone?.trim() || null,
      address: address?.trim() || null
    })
    .eq("id", params.id)
    .select()
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (!updated) {
    return NextResponse.json({ error: "No customer with that ID was found — nothing was saved." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
