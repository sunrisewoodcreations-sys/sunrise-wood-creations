import { createAdminClient } from "@/lib/supabase/admin";
import { sendOrderStatusEmail } from "@/lib/email";
import { shouldNotify } from "@/lib/notify";
import { consumePicketsFifo } from "@/lib/pickets";
import { checkStockAndAutoMarkReady } from "@/lib/invoice";
import { ProductType } from "@/lib/statusSteps";

// The exact order-creation logic that used to live only inside
// /api/orders/route.ts, extracted so a second, non-admin caller (a
// customer accepting a quote by token, no login involved) can create a
// real order the same way an admin does — same stock checks, same
// picket consumption, same auto-ready-for-pickup, same confirmation
// email — without a second, separately-maintained copy of any of it.
// The route itself still owns its own admin-auth check; this function
// assumes whoever calls it has already decided the request is allowed.

export type IncomingOrderItem = {
  productType: string;
  productId?: string | null;
  title: string;
  sizeDetails?: string;
  quantity?: number | string;
  priceCents?: number | string;
};

export async function createOrder(opts: {
  customerId: string;
  dueDate?: string | null;
  items: IncomingOrderItem[];
  isDemo?: boolean;
}): Promise<{ ok: true; order: any } | { ok: false; error: string; status: number }> {
  const admin = createAdminClient();
  const initialStatus = "order_placed";

  if (opts.dueDate && isNaN(Date.parse(opts.dueDate))) {
    return { ok: false, error: "Invalid due date", status: 400 };
  }
  if (opts.items.some(it => !it.productType || !it.title?.trim())) {
    return { ok: false, error: "Every item needs a product type and title", status: 400 };
  }

  const normalizedItems = opts.items.map(it => ({
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

  // Auto-set the production date to one day before pickup (glue cure
  // time) — computed directly on the date string, not a real Date
  // object, to avoid timezone conversion risk.
  function addDaysToDateStr(dateStr: string, days: number): string {
    const [year, month, day] = dateStr.split("-").map(Number);
    const d = new Date(Date.UTC(year, month - 1, day));
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  }
  function oneDayBefore(dateStr: string): string {
    return addDaysToDateStr(dateStr, -1);
  }
  function todayStrEastern(): string {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "numeric", day: "numeric" }).formatToParts(new Date());
    const year = parts.find(p => p.type === "year")!.value;
    const month = parts.find(p => p.type === "month")!.value.padStart(2, "0");
    const day = parts.find(p => p.type === "day")!.value.padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  let finalDueDate = opts.dueDate || null;
  let autoProductionDate: string | null;
  if (opts.dueDate) {
    autoProductionDate = oneDayBefore(opts.dueDate);
  } else {
    const today = todayStrEastern();
    autoProductionDate = addDaysToDateStr(today, 1);
    finalDueDate = addDaysToDateStr(today, 2);
  }

  const { data: order, error } = await admin
    .from("orders")
    .insert({
      customer_id: opts.customerId,
      product_type: orderProductType,
      title: orderTitle,
      size_details: orderSizeDetails,
      price_cents: totalPriceCents,
      quantity: totalQuantity,
      product_id: orderProductId,
      status: initialStatus,
      due_date: finalDueDate,
      production_date: autoProductionDate,
      is_demo: !!opts.isDemo
    })
    .select()
    .single();

  if (error) {
    return { ok: false, error: error.message, status: 400 };
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

  // If there's already enough stock on hand to cover this order, skip
  // straight to Ready for Pickup instead of waiting for a deposit or a
  // manual status change — same all-or-nothing stock check already used
  // elsewhere (invoices, status changes), just also run right at creation.
  await checkStockAndAutoMarkReady(admin, order);

  const { data: customer } = await admin
    .from("profiles")
    .select("email, full_name, has_real_email, notify_order_updates")
    .eq("id", opts.customerId)
    .single();

  if (customer && shouldNotify(customer, "order_updates")) {
    try {
      await sendOrderStatusEmail({
        toEmail: customer.email,
        customerName: customer.full_name || "there",
        productType: orderProductType as ProductType,
        orderTitle: order.title,
        orderId: order.id,
        newStatus: order.status
      });
    } catch (err) {
      console.error("Order-placed email failed to send:", err);
    }
  }

  return { ok: true, order };
}
