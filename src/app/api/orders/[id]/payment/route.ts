import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: adminProfile } = await supabase.from("profiles").select("role").eq("id", user?.id).single();

  if (adminProfile?.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { amountPaidCents } = await req.json();
  if (typeof amountPaidCents !== "number" || amountPaidCents < 0) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Just updates the amount — no automatic email. Use the "Send invoice"
  // button on the order page if you want to notify the customer.
  const { error } = await admin
    .from("orders")
    .update({ amount_paid_cents: Math.round(amountPaidCents) })
    .eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
