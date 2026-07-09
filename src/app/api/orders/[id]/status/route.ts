import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendOrderStatusEmail } from "@/lib/email";
import { issueInvoiceForOrder } from "@/lib/invoice";
import { ProductType } from "@/lib/statusSteps";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: adminProfile } = await supabase.from("profiles").select("role").eq("id", user?.id).single();

  if (adminProfile?.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { status } = await req.json();
  const admin = createAdminClient();

  const { data: order, error } = await admin
    .from("orders")
    .update({ status })
    .eq("id", params.id)
    .select("*, profiles:customer_id(email, full_name)")
    .single();

  if (error || !order) {
    return NextResponse.json({ error: error?.message || "Order not found" }, { status: 400 });
  }

  const customer = (order as any).profiles;

  // Marking an order picked up means it was paid for in person —
  // clear the balance automatically so the final invoice shows $0 due.
  if (status === "picked_up" && (order.amount_paid_cents || 0) < (order.price_cents || 0)) {
    await admin.from("orders").update({ amount_paid_cents: order.price_cents }).eq("id", order.id);
    order.amount_paid_cents = order.price_cents;
  }

  const balanceDueCents = status === "ready_for_pickup"
    ? (order.price_cents || 0) - (order.amount_paid_cents || 0)
    : undefined;

  await sendOrderStatusEmail({
    toEmail: customer.email,
    customerName: customer.full_name,
    productType: order.product_type as ProductType,
    orderTitle: order.title,
    orderId: order.id,
    newStatus: status,
    balanceDueCents
  });

  // Once an order is picked up, generate and email the final invoice.
  if (status === "picked_up") {
    try {
      await issueInvoiceForOrder(order, customer);
    } catch (err) {
      console.error("Invoice generation failed:", err);
    }
  }

  return NextResponse.json({ ok: true });
}
