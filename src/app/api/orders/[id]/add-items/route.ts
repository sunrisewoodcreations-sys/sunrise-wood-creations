import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeAddOnItems, isProductLine, retitleOrder } from "@/lib/orderAddOns";
import { generateInvoicePdfForOrder } from "@/lib/invoice";
import { sendOrderAddedItemsEmail } from "@/lib/email";
import { shouldNotify } from "@/lib/notify";

// Admin only: add items to an order that already exists (e.g. bags added
// later). Updates the order total, refreshes the SAME invoice (same number),
// and by default emails the customer what was added, the new total and
// balance, with the updated invoice attached.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: adminProfile } = await supabase.from("profiles").select("role").eq("id", user?.id).single();
  if (adminProfile?.role !== "admin") return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const body = await req.json();
  const parsed = normalizeAddOnItems(body.items);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const sendEmail = body.sendEmail !== false;

  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("*, profiles:customer_id(email, full_name, has_real_email, notify_order_updates, notify_invoices)")
    .eq("id", params.id)
    .single();
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (["picked_up", "completed"].includes(order.status)) {
    return NextResponse.json({ error: "This order is already picked up. Create a new order instead." }, { status: 400 });
  }

  const items = parsed.items;
  const addedTotal = items.reduce((s, it) => s + it.lineTotalCents, 0);
  const addedQty = items.reduce((s, it) => s + it.quantity, 0);

  const { error: itemsError } = await admin.from("order_items").insert(
    items.map(it => ({
      order_id: order.id,
      product_id: it.productId,
      product_type: it.productType,
      title: it.title,
      size_details: it.sizeDetails,
      quantity: it.quantity,
      unit_price_cents: Math.round(it.lineTotalCents / it.quantity),
      tax_exempt: it.taxExempt
    }))
  );
  if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 400 });

  const { data: allItems } = await admin
    .from("order_items").select("title, unit_price_cents").eq("order_id", order.id).order("created_at", { ascending: true });
  const productTitles = (allItems || []).filter((i: any) => isProductLine(i.title, i.unit_price_cents)).map((i: any) => i.title);

  const { data: updated, error: updateError } = await admin
    .from("orders")
    .update({
      price_cents: (order.price_cents || 0) + addedTotal,
      quantity: (order.quantity || 0) + addedQty,
      tax_exempt_cents: (order.tax_exempt_cents || 0) + items.filter(it => it.taxExempt).reduce((s, it) => s + it.lineTotalCents, 0),
      title: retitleOrder(order.title, productTitles),
      updated_at: new Date().toISOString()
    })
    .eq("id", order.id)
    .select()
    .single();
  if (updateError || !updated) return NextResponse.json({ error: updateError?.message || "Couldn't update the order" }, { status: 400 });

  const customer = (order as any).profiles;
  let emailed = false;
  try {
    const invoice = await generateInvoicePdfForOrder(updated, customer);
    if (sendEmail && customer && shouldNotify(customer, "order_updates")) {
      await sendOrderAddedItemsEmail({
        toEmail: customer.email,
        customerName: customer.full_name || "there",
        orderId: order.id,
        orderTitle: updated.title,
        addedItems: items.map(it => ({ title: it.title, quantity: it.quantity, lineTotalCents: it.lineTotalCents })),
        priceCents: updated.price_cents,
        amountPaidCents: updated.amount_paid_cents || 0,
        isDelivery: updated.fulfillment_method === "delivery",
        invoice: invoice ? { number: invoice.invoiceNumber, year: invoice.invoiceYear, pdfBuffer: invoice.pdfBuffer } : undefined,
        forceDemo: typeof updated.is_demo === "boolean" ? updated.is_demo : true
      });
      emailed = true;
    }
  } catch (err) {
    console.error("Add-items invoice/email failed:", err);
  }

  return NextResponse.json({ ok: true, order: updated, emailed });
}
