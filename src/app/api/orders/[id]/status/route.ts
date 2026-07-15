import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { issueInvoiceForOrder, generateInvoicePdfForOrder } from "@/lib/invoice";
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

  // Being built / being assembled notify the customer automatically with
  // a plain status update, same as order_placed. Ready for pickup also
  // notifies automatically, but with the invoice PDF attached — reusing
  // the exact same invoice-generation code as the manual "Send invoice"
  // button and the picked_up flow, so this never creates a second
  // invoice or a new invoice number; it always reuses whatever invoice
  // number already exists for this order (or creates the first one).
  // Every other status change stays silent — use the "Send email"
  // button on the order page for those.
  if (status === "being_built" || status === "being_assembled") {
    if (shouldNotify(customer, "order_updates")) {
      try {
        await sendOrderStatusEmail({
          toEmail: customer.email,
          customerName: customer.full_name,
          productType: order.product_type as ProductType,
          orderTitle: order.title,
          orderId: order.id,
          newStatus: status
        });
      } catch (err) {
        console.error("Status-update email failed to send:", err);
      }
    }
  }

  if (status === "ready_for_pickup") {
    let invoicePdfBuffer: Buffer | undefined;
    let invoiceNumber: number | undefined;
    try {
      const result = await generateInvoicePdfForOrder(order, customer);
      if (result) {
        invoicePdfBuffer = result.pdfBuffer;
        invoiceNumber = result.invoiceNumber;
      }
    } catch (err) {
      console.error("Invoice generation for Ready for Pickup email failed:", err);
    }

    if (shouldNotify(customer, "order_updates")) {
      const balanceDueCents = (order.price_cents || 0) - (order.amount_paid_cents || 0);
      try {
        await sendOrderStatusEmail({
          toEmail: customer.email,
          customerName: customer.full_name,
          productType: order.product_type as ProductType,
          orderTitle: order.title,
          orderId: order.id,
          newStatus: status,
          balanceDueCents,
          invoicePdfBuffer,
          invoiceNumber
        });
      } catch (err) {
        console.error("Status-update email failed to send:", err);
      }
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
