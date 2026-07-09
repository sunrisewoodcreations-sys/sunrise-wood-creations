import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { issueInvoiceForOrder } from "@/lib/invoice";

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

  // Grab the current amount before overwriting it, so we only send a
  // new invoice when the payment actually changed.
  const { data: existingOrder } = await admin
    .from("orders")
    .select("amount_paid_cents")
    .eq("id", params.id)
    .single();

  const previousAmountPaidCents = existingOrder?.amount_paid_cents ?? 0;
  const roundedNewAmount = Math.round(amountPaidCents);

  const { data: order, error } = await admin
    .from("orders")
    .update({ amount_paid_cents: roundedNewAmount })
    .eq("id", params.id)
    .select("*, profiles:customer_id(email, full_name)")
    .single();

  if (error || !order) {
    return NextResponse.json({ error: error?.message || "Order not found" }, { status: 400 });
  }

  if (roundedNewAmount !== previousAmountPaidCents) {
    const customer = (order as any).profiles;
    try {
      await issueInvoiceForOrder(order, customer);
    } catch (err) {
      console.error("Invoice generation failed:", err);
    }
  }

  return NextResponse.json({ ok: true });
}
