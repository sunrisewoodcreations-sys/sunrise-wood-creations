import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validatePaymentInput, syncOrderPaid } from "@/lib/payments";

async function requireAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: p } = await supabase.from("profiles").select("role").eq("id", user?.id).single();
  return p?.role === "admin";
}

// Add a payment (amount + how it was paid) to an order.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  const v = validatePaymentInput(await req.json().catch(() => ({})));
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
  const admin = createAdminClient();
  const { error } = await admin.from("order_payments").insert({
    order_id: params.id,
    amount_cents: v.value.amountCents,
    method: v.value.method,
    reference: v.value.reference || null
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const total = await syncOrderPaid(admin, params.id);
  return NextResponse.json({ ok: true, amountPaidCents: total });
}

// Remove a payment that was entered by mistake.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  const paymentId = req.nextUrl.searchParams.get("paymentId");
  if (!paymentId) return NextResponse.json({ error: "Missing payment" }, { status: 400 });
  const admin = createAdminClient();
  const { error } = await admin.from("order_payments").delete().eq("id", paymentId).eq("order_id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const total = await syncOrderPaid(admin, params.id);
  return NextResponse.json({ ok: true, amountPaidCents: total });
}

// Change the date a payment was received. Entered as the calendar day (YYYY-MM-DD).
// If it is the first payment on the order (the deposit), the "Deposit received"
// step in the order's timeline is moved to the same day so both agree.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  const { paymentId, paidDate } = await req.json().catch(() => ({}));
  if (!paymentId || typeof paidDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(paidDate) || isNaN(Date.parse(paidDate))) {
    return NextResponse.json({ error: "Pick a valid date" }, { status: 400 });
  }
  // Midday UTC-ish keeps the same calendar day in Eastern time year-round.
  const stamp = new Date(`${paidDate}T16:00:00Z`).toISOString();

  const admin = createAdminClient();
  const { data: all } = await admin.from("order_payments").select("id, paid_at").eq("order_id", params.id).order("paid_at", { ascending: true });
  const isFirst = !!all && all.length > 0 && all[0].id === paymentId;

  const { error } = await admin.from("order_payments").update({ paid_at: stamp }).eq("id", paymentId).eq("order_id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  if (isFirst) {
    await admin.from("order_status_history").update({ created_at: stamp }).eq("order_id", params.id).eq("status", "deposit_received");
  }
  return NextResponse.json({ ok: true, movedDepositStep: isFirst });
}
