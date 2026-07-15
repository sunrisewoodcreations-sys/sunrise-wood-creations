import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { issueInvoiceForOrder } from "@/lib/invoice";
import { sendOrderStatusEmail } from "@/lib/email";
import { shouldNotify } from "@/lib/notify";
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
    .select("*, profiles:customer_id(email, full_name, has_real_email, notify_invoices, notify_order_updates)")
    .single();

  if (error || !order) {
    return NextResponse.json({ error: error?.message || "Order not found" }, { status: 400 });
  }

  const customer = (order as any).profiles;

  // Marking an order picked up means it was paid for in person —
  // clear the balance automatically so the final invoice shows $0 due.
  // This is the only status change that sends an email automatically;
  // every other status change is silent — use the "Send email" button
  // on the order page to notify the customer manually.
  // Three status changes trigger an automatic invoice email:
  // deposit_received (shows what's left after the deposit), and
  // picked_up (shows the final, zeroed-out balance). Every other status
  // change stays silent — use the buttons on the order page instead.
  // Being built / being assembled and ready for pickup now also notify
  // the customer automatically, same as order_placed — everything else
  // (design proof sent, design approved, etc.) stays silent; use the
  // "Send email" button on the order page for those.
  if (["being_built", "being_assembled", "ready_for_pickup"].includes(status) && shouldNotify(customer, "order_updates")) {
    const balanceDueCents = status === "ready_for_pickup"
      ? (order.price_cents || 0) - (order.amount_paid_cents || 0)
      : undefined;
    try {
      await sendOrderStatusEmail({
        toEmail: customer.email,
        customerName: customer.full_name,
        productType: order.product_type as ProductType,
        orderTitle: order.title,
        orderId: order.id,
        newStatus: status,
        balanceDueCents
      });
    } catch (err) {
      console.error("Status-update email failed to send:", err);
    }
  }

  if (status === "deposit_received") {
    try {
      await issueInvoiceForOrder(order, customer);
    } catch (err) {
      console.error("Invoice generation failed:", err);
    }
  }

  if (status === "picked_up") {
    if ((order.amount_paid_cents || 0) < (order.price_cents || 0)) {
      await admin.from("orders").update({ amount_paid_cents: order.price_cents }).eq("id", order.id);
      order.amount_paid_cents = order.price_cents;
    }
    try {
      await issueInvoiceForOrder(order, customer);
    } catch (err) {
      console.error("Invoice generation failed:", err);
    }
  }

  return NextResponse.json({ ok: true });
}
