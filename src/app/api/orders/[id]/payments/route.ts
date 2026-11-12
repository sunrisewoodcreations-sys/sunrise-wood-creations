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
