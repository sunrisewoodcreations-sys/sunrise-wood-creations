import { createAdminClient } from "@/lib/supabase/admin";
import { sendOrderStatusEmail } from "@/lib/email";
import { shouldNotify } from "@/lib/notify";
import { consumePicketsFifo } from "@/lib/pickets";
import { checkStockAndAutoMarkReady } from "@/lib/invoice";
import { getOrCreatePickupSchedulingUrl } from "@/lib/pickupScheduling";
import { ProductType } from "@/lib/statusSteps";
import { formatOrderNumber } from "@/lib/orderDisplay";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://sunrisewoodcreations.com";

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

  // A coupon applied at order creation is stored as its own negative-
  // price line item (see AddOrderWithCustomerPicker) so it flows
  // through the existing order-total and invoice code unchanged — but
  // it's a discount, not a product, so it should never count toward
  // "+N more items" in the order's own title, or decide whether this
  // order's single-item fields (size details, product id) get shown.
  // A real line item never has a negative price, so that's the signal.
  // The "Delivery fee" line (added by a delivery on a manual order, or by
  // converting a quote that had delivery) is likewise a charge, not a
  // product, so it is also left out of the title and single-item fields.
  const productItems = normalizedItems.filter(it => it.priceCents >= 0 && it.title !== "Delivery fee");
  const titleItems = productItems.length > 0 ? productItems : normalizedItems;

  const orderTitle = titleItems.length === 1
    ? titleItems[0].title
    : `${titleItems[0].title} + ${titleItems.length - 1} more item${titleItems.length - 1 === 1 ? "" : "s"}`;
  const orderSizeDetails = titleItems.length === 1 ? titleItems[0].sizeDetails : null;
  const orderProductType = titleItems[0].productType;
  const orderProductId = titleItems.length === 1 ? titleItems[0].productId : null;

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

  // If stock was already on hand, checkStockAndAutoMarkReady() above may
  // have skipped this order straight to ready_for_pickup. When that
  // happens for a pickup order, fold the scheduling link into this same
  // confirmation email instead of sending a separate one — same
  // no-duplicate guard used everywhere else this can happen.
  let schedulingUrl: string | undefined;
  if (order.status === "ready_for_pickup") {
    try {
      const schedulingResult = await getOrCreatePickupSchedulingUrl(order.id, SITE_URL);
      if (schedulingResult.ok) schedulingUrl = schedulingResult.url;
    } catch (err) {
      console.error("Pickup scheduling link generation failed:", err);
    }
  }

  if (customer && shouldNotify(customer, "order_updates")) {
    try {
      await sendOrderStatusEmail({
        toEmail: customer.email,
        customerName: customer.full_name || "there",
        productType: orderProductType as ProductType,
        orderTitle: order.title,
        orderId: order.id,
        newStatus: order.status,
        schedulingUrl,
        priceCents: order.price_cents,
        amountPaidCents: order.amount_paid_cents,
        // The customer-facing number ("SWC-1001") is assigned by the
        // database at the moment of insert, so it's already on `order`
        // here. If it's missing for any reason (for example the
        // order_number migration hasn't been run yet), this is undefined
        // and the email looks it up itself and, failing that, just leaves
        // the line out. Display only: nothing identifies an order by it.
        orderNumberDisplay: formatOrderNumber(order.order_number, order.is_demo) ?? undefined,
        // This single change is also what closes the gap for the public,
        // no-login "accept this quote" link (src/app/api/quotes/token/
        // [token]/accept/route.ts): that route has no logged-in session
        // at all by design, so sendViaResend's session-based demo check
        // can never see it — but it already passes isDemo through into
        // this same createOrder() call, which is what order.is_demo
        // below actually reflects. Fail-safe: if this ever came back as
        // something other than a real boolean (should never happen —
        // the column is NOT NULL with a default), treat it as demo
        // rather than assume it's safe to email a real inbox.
        forceDemo: typeof order.is_demo === "boolean" ? order.is_demo : true
      });
    } catch (err) {
      console.error("Order-placed email failed to send:", err);
    }
  }

  return { ok: true, order };
}
