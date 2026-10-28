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

  const { amountPaidCents, paymentMethod, paymentReference } = await req.json();
  if (typeof amountPaidCents !== "number" || amountPaidCents < 0) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  }

  const update: Record<string, any> = { amount_paid_cents: Math.round(amountPaidCents) };

  // Payment method is only touched when the form sends it, so saving just an
  // amount keeps working. Venmo / Zelle need a transaction number.
  if (paymentMethod !== undefined) {
    if (paymentMethod !== null && !["cash", "card", "check", "venmo", "zelle"].includes(paymentMethod)) {
      return NextResponse.json({ error: "Invalid payment method" }, { status: 400 });
    }
    const ref = typeof paymentReference === "string" ? paymentReference.trim().slice(0, 100) : "";
    if ((paymentMethod === "venmo" || paymentMethod === "zelle") && !ref) {
      return NextResponse.json({ error: `Enter the ${paymentMethod === "venmo" ? "Venmo" : "Zelle"} transaction number.` }, { status: 400 });
    }
    update.payment_method = paymentMethod;
    update.payment_reference = paymentMethod && paymentMethod !== "cash" ? (ref || null) : null;
  }

  const admin = createAdminClient();

  // Just updates the amount — no automatic email. Use the "Send invoice"
  // button on the order page if you want to notify the customer.
  const { error } = await admin
    .from("orders")
    .update(update)
    .eq("id", params.id);

  if (error) {
    const missing = /payment_method|payment_reference/.test(error.message);
    return NextResponse.json({ error: missing ? "Payment method isn't set up in the database yet — run the payment method SQL first." : error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
