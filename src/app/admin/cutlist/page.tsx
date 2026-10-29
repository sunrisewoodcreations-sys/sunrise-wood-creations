import { createClient } from "@/lib/supabase/server";
import CutListGenerator from "@/components/CutListGenerator";

function easternDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", year: "numeric", month: "numeric", day: "numeric"
  }).formatToParts(date);
  return {
    year: Number(parts.find(p => p.type === "year")?.value),
    month: Number(parts.find(p => p.type === "month")?.value),
    day: Number(parts.find(p => p.type === "day")?.value)
  };
}
function dateStr(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export default async function CutListPage() {
  const supabase = createClient();

  const { year, month, day } = easternDateParts(new Date());
  const todayStr = dateStr(year, month, day);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const { year: ty, month: tm, day: td } = easternDateParts(tomorrow);
  const tomorrowStr = dateStr(ty, tm, td);

  const [
    { data: products },
    { data: bomParts },
    { data: orders },
    { data: orderItems },
    { data: savedCutLists }
  ] = await Promise.all([
    supabase.from("products").select("id, name, stock_quantity").eq("product_type", "planter"),
    supabase.from("product_bom_parts").select("*"),
    supabase
      .from("orders")
      .select("*, profiles:customer_id(full_name)")
      .eq("product_type", "planter")
      .neq("status", "picked_up")
      .gte("production_date", todayStr),
    supabase.from("order_items").select("*, orders:order_id(production_date, product_type, status, production_status, created_at, stock_deducted)"),
    supabase.from("saved_cut_lists").select("*").order("created_at", { ascending: false })
  ]);

  // Only products with at least one defined part can generate a cut list.
  const productIdsWithParts = new Set((bomParts || []).map((p: any) => p.product_id));
  const bomReadyProducts = (products || []).filter(p => productIdsWithParts.has(p.id));

  const bomPartsByProduct: Record<string, any[]> = {};
  (bomParts || []).forEach((part: any) => {
    if (!bomPartsByProduct[part.product_id]) bomPartsByProduct[part.product_id] = [];
    bomPartsByProduct[part.product_id].push(part);
  });

  // Build today/tomorrow job lists from real orders — covering both
  // legacy single-item orders (orders.product_id) and multi-item orders
  // (order_items.product_id), matching how the rest of the app already
  // handles this split.
  type Job = { orderId: string; orderTitle: string; customerName: string; productId: string | null; productName: string | null; quantity: number; orderedQuantity: number; createdAt?: string; stockDeducted?: boolean; hasBOM: boolean; productionStatus: string; orderStatus: string };

  function buildJobs(dateStrToMatch: string): Job[] {
    const jobs: Job[] = [];

    // order_items is the source of truth here — every order created by
    // the current order form gets an order_items row, even single-item
    // ones. Scanning orders.product_id AND order_items independently
    // (as this used to) double-counted every such order. Only orders
    // with zero order_items rows at all (true legacy orders, if any)
    // fall back to the direct orders.product_id path below.
    const orderIdsWithItems = new Set((orderItems || []).map((it: any) => it.order_id));

    (orderItems || []).forEach((it: any) => {
      if (it.orders?.production_date !== dateStrToMatch || it.orders?.product_type !== "planter" || ["picked_up", "ready_for_pickup", "completed"].includes(it.orders?.status) || it.orders?.stock_deducted) return;
      if (!it.product_id) return;
      const product = (products || []).find(p => p.id === it.product_id);
      const order = (orders || []).find(o => o.id === it.order_id) as any;
      jobs.push({
        createdAt: it.orders?.created_at || "", stockDeducted: !!it.orders?.stock_deducted,
        orderId: it.order_id,
        orderTitle: order?.profiles?.full_name || product?.name || "Order item",
        customerName: order?.profiles?.full_name || "",
        productId: it.product_id,
        productName: product?.name || null,
        quantity: Math.max(0, (it.quantity || 1) - (it.stock_reserved_qty || 0)),
        orderedQuantity: it.quantity || 1,
        hasBOM: productIdsWithParts.has(it.product_id),
        productionStatus: it.orders?.production_status || "waiting",
        orderStatus: it.orders?.status || "order_placed"
      });
    });

    (orders || []).forEach((o: any) => {
      if (o.production_date !== dateStrToMatch || !o.product_id) return;
      if (orderIdsWithItems.has(o.id)) return; // already counted above via order_items
      if (["picked_up", "ready_for_pickup", "completed"].includes(o.status) || o.stock_deducted) return;
      const product = (products || []).find(p => p.id === o.product_id);
      jobs.push({
        createdAt: o.created_at || "", stockDeducted: !!o.stock_deducted,
        orderId: o.id,
        orderTitle: o.title,
        customerName: o.profiles?.full_name || "Unknown",
        productId: o.product_id,
        productName: product?.name || null,
        quantity: Math.max(0, (o.quantity || 1) - (o.stock_reserved_qty || 0)),
        orderedQuantity: o.quantity || 1,
        hasBOM: productIdsWithParts.has(o.product_id),
        productionStatus: o.production_status || "waiting",
        orderStatus: o.status || "order_placed"
      });
    });

    return jobs;
  }

  // Jobs for every upcoming production date, so any day can be picked.
  const upcomingDates = new Set<string>();
  (orders || []).forEach((o: any) => { if (o.production_date && o.production_date >= todayStr) upcomingDates.add(o.production_date); });
  (orderItems || []).forEach((it: any) => {
    const d = it.orders?.production_date;
    if (d && d >= todayStr && it.orders?.product_type === "planter") upcomingDates.add(d);
  });
  const jobsByDate: Record<string, Job[]> = {};
  upcomingDates.forEach(d => { jobsByDate[d] = buildJobs(d); });

  // Nothing left to build for a job (its pieces are already set aside from
  // stock) means it doesn't belong on the cut list at all.
  Object.keys(jobsByDate).forEach(d => { jobsByDate[d] = jobsByDate[d].filter(j => j.quantity > 0); });

  return (
    <CutListGenerator
      jobsByDate={jobsByDate}
      todayStr={todayStr}
      bomReadyProducts={bomReadyProducts}
      bomPartsByProduct={bomPartsByProduct}
      todayJobs={buildJobs(todayStr).filter(j => j.quantity > 0)}
      tomorrowJobs={buildJobs(tomorrowStr).filter(j => j.quantity > 0)}
      savedCutLists={savedCutLists || []}
    />
  );
}
