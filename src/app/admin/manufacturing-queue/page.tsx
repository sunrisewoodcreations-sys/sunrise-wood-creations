import { createClient } from "@/lib/supabase/server";
import { getWorkflowStage } from "@/lib/workflow";
import { checkMaterialAvailabilityForOrder } from "@/lib/materialPlanning";
import ManufacturingQueue from "@/components/ManufacturingQueue";

export default async function ManufacturingQueuePage() {
  const supabase = createClient();

  const [{ data: orders }, { data: orderItems }, { data: proofs }] = await Promise.all([
    supabase
      .from("orders")
      .select("id, title, product_type, status, production_status, priority, production_date, due_date, customer_id, profiles:customer_id(full_name)")
      .in("production_status", ["building", "assembly", "finishing"])
      .neq("status", "picked_up"),
    supabase.from("order_items").select("order_id, product_id, quantity, title, products:product_id(name, estimated_build_minutes)"),
    supabase.from("proofs").select("order_id").eq("status", "pending")
  ]);

  const waitingOnCustomerOrderIds = new Set((proofs || []).map((p: any) => p.order_id));

  const itemsByOrder: Record<string, any[]> = {};
  (orderItems || []).forEach((it: any) => {
    if (!itemsByOrder[it.order_id]) itemsByOrder[it.order_id] = [];
    itemsByOrder[it.order_id].push(it);
  });

  // Material readiness — same check Material Planning and the order
  // page already use, just run for this bounded set of currently-
  // building orders (never expensive here, since this page is
  // deliberately scoped to only what's actively in production).
  const materialChecks = await Promise.all(
    (orders || []).map(o => checkMaterialAvailabilityForOrder(o.id).then(r => [o.id, r] as const))
  );
  const materialCheckByOrderId = new Map(materialChecks);

  const queueOrders = (orders || []).map((o: any) => {
    const items = itemsByOrder[o.id] || [];
    const workflowStage = getWorkflowStage(o, waitingOnCustomerOrderIds.has(o.id), materialCheckByOrderId.get(o.id)?.available ?? null);

    // Sum whatever build-time estimates exist across this order's items;
    // note honestly if any item's product has no estimate set, rather
    // than silently under-counting the total.
    let totalBuildMinutes = 0;
    let anyMissing = false;
    if (items.length > 0) {
      items.forEach((it: any) => {
        const perItemMinutes = it.products?.estimated_build_minutes;
        if (perItemMinutes == null) { anyMissing = true; return; }
        totalBuildMinutes += perItemMinutes * (it.quantity || 1);
      });
    } else {
      anyMissing = true; // legacy single-item order with no linked product to check
    }

    return {
      id: o.id,
      customerName: o.profiles?.full_name || "Unknown",
      productType: o.product_type,
      title: o.title,
      products: items.length > 0 ? items.map((it: any) => it.products?.name || it.title) : [o.title],
      quantity: items.length > 0 ? items.reduce((sum: number, it: any) => sum + (it.quantity || 1), 0) : 1,
      productionDate: o.production_date,
      priority: o.priority,
      workflowStage,
      materialCheck: materialCheckByOrderId.get(o.id) || { available: true, shortages: [] },
      estimatedBuildMinutes: totalBuildMinutes > 0 ? totalBuildMinutes : null,
      buildTimePartiallyTracked: anyMissing && totalBuildMinutes > 0
    };
  });

  // "In production order" — highest priority first, then earliest
  // production date, matching the sequencing already established
  // elsewhere (Production Schedule sorts the same way conceptually).
  const priorityRank: Record<string, number> = { high: 0, normal: 1, low: 2 };
  queueOrders.sort((a, b) => {
    const pDiff = (priorityRank[a.priority || "normal"] ?? 1) - (priorityRank[b.priority || "normal"] ?? 1);
    if (pDiff !== 0) return pDiff;
    return (a.productionDate || "9999-99-99").localeCompare(b.productionDate || "9999-99-99");
  });

  return <ManufacturingQueue orders={queueOrders} />;
}
