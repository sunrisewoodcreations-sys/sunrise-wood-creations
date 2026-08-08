import { createClient } from "@/lib/supabase/server";
import { getWorkflowStage } from "@/lib/workflow";
import { checkMaterialAvailabilityForOrder } from "@/lib/materialPlanning";
import { sortProductionQueue } from "@/lib/productionQueue";
import ManufacturingQueue from "@/components/ManufacturingQueue";

export default async function ManufacturingQueuePage() {
  const supabase = createClient();

  const [{ data: orders }, { data: orderItems }, { data: proofs }, { data: scheduledPickups }] = await Promise.all([
    supabase
      .from("orders")
      .select("id, title, product_type, status, production_status, priority, production_date, due_date, customer_id, manual_queue_position, profiles:customer_id(full_name, is_priority_customer)")
      .in("production_status", ["building", "assembly", "finishing"])
      .neq("status", "picked_up"),
    supabase.from("order_items").select("order_id, product_id, quantity, title, products:product_id(name, size_details, estimated_build_minutes, image_url)"),
    supabase.from("proofs").select("order_id").eq("status", "pending"),
    // Safe even before the pickup scheduling migration has been run —
    // Supabase returns a null-data error rather than throwing.
    supabase.from("pickup_appointments").select("order_id, appointment_date, appointment_time").eq("status", "scheduled")
  ]);

  const waitingOnCustomerOrderIds = new Set((proofs || []).map((p: any) => p.order_id));
  const scheduledPickupByOrderId = new Map((scheduledPickups || []).map((p: any) => [p.order_id, p]));

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
    const scheduledPickup = scheduledPickupByOrderId.get(o.id) || null;

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

    const materialCheck = materialCheckByOrderId.get(o.id) || { available: true, shortages: [] };

    return {
      id: o.id,
      customerName: o.profiles?.full_name || "Unknown",
      isPriorityCustomer: !!o.profiles?.is_priority_customer,
      productType: o.product_type,
      title: o.title,
      products: items.length > 0 ? items.map((it: any) => it.products?.name || it.title) : [o.title],
      productPhotoUrl: items.length > 0 ? (items[0].products?.image_url || null) : null,
      sizeDetails: items.length > 0 ? items[0].products?.size_details || null : null,
      quantity: items.length > 0 ? items.reduce((sum: number, it: any) => sum + (it.quantity || 1), 0) : 1,
      productionDate: o.production_date,
      dueDate: o.due_date,
      priority: o.priority,
      manualQueuePosition: o.manual_queue_position,
      workflowStage,
      materialCheck,
      estimatedBuildMinutes: totalBuildMinutes > 0 ? totalBuildMinutes : null,
      buildTimePartiallyTracked: anyMissing && totalBuildMinutes > 0,
      scheduledPickupDate: scheduledPickup?.appointment_date || null,
      scheduledPickupTime: scheduledPickup?.appointment_time || null,
      productionStatus: o.production_status
    };
  });

  // Automatic multi-factor priority: rush first, then earliest promised
  // date, then whether pickup is already on the books, then customer
  // priority, then material readiness — with any manually dragged
  // orders floating to the top in their exact chosen order. See
  // sortProductionQueue for the full, independently-tested logic.
  const sortedQueueOrders = sortProductionQueue(
    queueOrders.map(o => ({
      ...o,
      dueDate: o.dueDate,
      hasScheduledPickup: !!o.scheduledPickupDate,
      isPriorityCustomer: o.isPriorityCustomer,
      materialsAvailable: o.materialCheck.available,
      manualQueuePosition: o.manualQueuePosition
    }))
  );

  return <ManufacturingQueue orders={sortedQueueOrders} />;
}
