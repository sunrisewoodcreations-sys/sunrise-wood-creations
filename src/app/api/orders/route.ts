import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendOrderStatusEmail } from "@/lib/email";
import { shouldNotify } from "@/lib/notify";
import { consumePicketsFifo } from "@/lib/pickets";
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

  const orderTitle = normalizedItems.length === 1
    ? normalizedItems[0].title
    : `${normalizedItems[0].title} + ${normalizedItems.length - 1} more item${normalizedItems.length - 1 === 1 ? "" : "s"}`;
  const orderSizeDetails = normalizedItems.length === 1 ? normalizedItems[0].sizeDetails : null;
  const orderProductType = normalizedItems[0].productType;
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

  const { data: insertedItems, error: itemsError } = await admin.from("order_items").insert(
    normalizedItems.map(it => ({
      order_id: order.id,
      product_id: it.productId,
      product_type: it.productType,
      title: it.title,
      size_details: it.sizeDetails,
      quantity: it.quantity,
      unit_price_cents: it.quantity > 0 ? Math.round(it.priceCents / it.quantity) : it.priceCents
    }))
  ).select();

  if (itemsError) {
    console.error("Couldn't save order items:", itemsError.message);
  }

  // Auto-log picket usage for any item linked to a saved product that
  // has a default "pickets per unit" set — no manual entry needed.
  const productIds = [...new Set((insertedItems || []).map((it: any) => it.product_id).filter(Boolean))];
  if (productIds.length > 0) {
    const { data: linkedProducts } = await admin
      .from("products")
      .select("id, pickets_per_unit")
      .in("id", productIds);

    const picketsPerUnitByProduct: Record<string, number> = {};
    (linkedProducts || []).forEach((p: any) => { picketsPerUnitByProduct[p.id] = p.pickets_per_unit || 0; });

    for (const item of insertedItems || []) {
      const perUnit = item.product_id ? picketsPerUnitByProduct[item.product_id] || 0 : 0;
      if (perUnit > 0) {
        const neededQty = perUnit * item.quantity;
        const result = await consumePicketsFifo(admin, neededQty, order.id, item.id);
        if (result.ok) {
          await admin.from("order_items").update({
            pickets_used: neededQty,
            material_cost_cents: result.totalCostCents
          }).eq("id", item.id);
        } else {
          console.error(`Auto picket consumption failed for item ${item.id}:`, result.error);
        }
      }
    }
  }

  const { data: customer } = await supabase
    .from("profiles")
    .select("email, full_name, has_real_email, notify_order_updates")
    .eq("id", customerId)
    .single();

  if (customer && shouldNotify(customer, "order_updates")) {
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
