import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendOrderStatusEmail } from "@/lib/email";
import { ProductType } from "@/lib/statusSteps";

type IncomingItem = {
  productType: string;
  productId?: string | null;
  title: string;
  sizeDetails?: string;
  quantity?: number | string;
  priceCents?: number | string;
};

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: adminProfile } = await supabase.from("profiles").select("role").eq("id", user?.id).single();

  if (adminProfile?.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const body = await req.json();
  const { customerId } = body;

  if (!customerId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const admin = createAdminClient();
  const initialStatus = "order_placed";

  let items: IncomingItem[];

  // New multi-item orders send an `items` array. The older single-item
  // form (still used on a customer's individual page) sends flat fields
  // directly — normalize that into the same one-item array shape so both
  // paths share the same logic below.
  if (Array.isArray(body.items) && body.items.length > 0) {
    items = body.items;
  } else {
    const { productType, title, sizeDetails, priceCents, quantity, productId } = body;
    if (!productType || !title?.trim()) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    items = [{ productType, productId, title, sizeDetails, quantity, priceCents }];
  }

  if (items.some(it => !it.productType || !it.title?.trim())) {
    return NextResponse.json({ error: "Every item needs a product type and title" }, { status: 400 });
  }

  const normalizedItems = items.map(it => ({
    productType: it.productType,
    productId: it.productId || null,
    title: it.title.trim(),
    sizeDetails: it.sizeDetails || null,
    quantity: Math.max(1, Math.round(Number(it.quantity)) || 1),
    priceCents: Math.round(Number(it.priceCents)) || 0
  }));

  const totalPriceCents = normalizedItems.reduce((sum, it) => sum + it.priceCents, 0);
  const totalQuantity = normalizedItems.reduce((sum, it) => sum + it.quantity, 0);

  // The order-level title/size/product summarize the whole order for
  // places that just need one line (like the orders list table). The
  // real breakdown lives in order_items.
  const orderTitle = normalizedItems.length === 1
    ? normalizedItems[0].title
    : `${normalizedItems[0].title} + ${normalizedItems.length - 1} more item${normalizedItems.length - 1 === 1 ? "" : "s"}`;
  const orderSizeDetails = normalizedItems.length === 1 ? normalizedItems[0].sizeDetails : null;
  // If every item shares one product type, use that for the status/progress
  // bar; otherwise default to the first item's type (mixed-type orders are
  // a known simplification — the progress bar reflects the first item).
  const orderProductType = normalizedItems.every(it => it.productType === normalizedItems[0].productType)
    ? normalizedItems[0].productType
    : normalizedItems[0].productType;
  const orderProductId = normalizedItems.length === 1 ? normalizedItems[0].productId : null;

  const { data: order, error } = await admin
    .from("orders")
    .insert({
      customer_id: customerId,
      product_type: orderProductType,
      title: orderTitle,
      size_details: orderSizeDetails,
      price_cents: totalPriceCents,
      quantity: totalQuantity,
      product_id: orderProductId,
      status: initialStatus
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const { error: itemsError } = await admin.from("order_items").insert(
    normalizedItems.map(it => ({
      order_id: order.id,
      product_id: it.productId,
      title: it.title,
      size_details: it.sizeDetails,
      quantity: it.quantity,
      unit_price_cents: it.quantity > 0 ? Math.round(it.priceCents / it.quantity) : it.priceCents
    }))
  );

  if (itemsError) {
    console.error("Couldn't save order items:", itemsError.message);
  }

  const { data: customer } = await supabase
    .from("profiles")
    .select("email, full_name")
    .eq("id", customerId)
    .single();

  if (customer?.email) {
    try {
      await sendOrderStatusEmail({
        toEmail: customer.email,
        customerName: customer.full_name || "there",
        productType: orderProductType as ProductType,
        orderTitle: order.title,
        orderId: order.id,
        newStatus: initialStatus
      });
    } catch (err) {
      console.error("Order-placed email failed to send:", err);
    }
  }

  return NextResponse.json({ ok: true, order });
}
