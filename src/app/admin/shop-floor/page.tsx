import { createClient } from "@/lib/supabase/server";
import { checkMaterialAvailabilityForOrder } from "@/lib/materialPlanning";
import { sortProductionQueue } from "@/lib/productionQueue";
import ShopFloorView from "@/components/ShopFloorView";

// Reuses the exact same data shape and sort algorithm as Manufacturing
// Queue — Shop Floor Mode is a simplified, large-touch-target view of
// the same underlying queue, not a second, differently-ordered list.
export default async function ShopFloorPage() {
  const supabase = createClient();

  const [{ data: orders }, { data: orderItems }, { data: scheduledPickups }, { data: buildSessions }] = await Promise.all([
    supabase
      .from("orders")
      .select("id, title, product_type, status, production_status, priority, production_date, due_date, customer_id, manual_queue_position, production_notes, profiles:customer_id(full_name, is_priority_customer)")
      .in("production_status", ["waiting", "building", "assembly", "finishing"])
      .neq("status", "picked_up"),
    supabase.from("order_items").select("order_id, product_id, quantity, title, products:product_id(name, size_details, estimated_build_minutes, image_url)"),
    supabase.from("pickup_appointments").select("order_id, appointment_date, appointment_time").eq("status", "scheduled"),
    // Any in-progress (not yet finished) timer session, so the page
    // can show "already running" state on load rather than losing it.
    supabase.from("order_build_sessions").select("*").in("status", ["running", "paused"])
  ]);

  const orderIds = (orders || []).map((o: any) => o.id);
  const productIds = [...new Set((orderItems || []).map((it: any) => it.product_id).filter(Boolean))];

  const [
    { data: checklistItems }, { data: checklistProgress },
    { data: bomParts }, { data: materialProgress },
    { data: progressPhotos }
  ] = await Promise.all([
    productIds.length > 0 ? supabase.from("product_checklist_items").select("*").in("product_id", productIds).order("sort_order", { ascending: true }) : Promise.resolve({ data: [] }),
    orderIds.length > 0 ? supabase.from("order_checklist_progress").select("*").in("order_id", orderIds) : Promise.resolve({ data: [] }),
    productIds.length > 0 ? supabase.from("product_bom_parts").select("*").in("product_id", productIds).order("sort_order", { ascending: true }) : Promise.resolve({ data: [] }),
    orderIds.length > 0 ? supabase.from("order_material_checklist_progress").select("*").in("order_id", orderIds) : Promise.resolve({ data: [] }),
    orderIds.length > 0 ? supabase.from("order_progress_photos").select("*").in("order_id", orderIds).order("created_at", { ascending: false }) : Promise.resolve({ data: [] })
  ]);

  const scheduledPickupByOrderId = new Map((scheduledPickups || []).map((p: any) => [p.order_id, p]));
  const activeSessionByOrderId = new Map((buildSessions || []).map((s: any) => [s.order_id, s]));

  const itemsByOrder: Record<string, any[]> = {};
  (orderItems || []).forEach((it: any) => {
    if (!itemsByOrder[it.order_id]) itemsByOrder[it.order_id] = [];
    itemsByOrder[it.order_id].push(it);
  });

  const materialChecks = await Promise.all(
    (orders || []).map(o => checkMaterialAvailabilityForOrder(o.id).then(r => [o.id, r] as const))
  );
  const materialCheckByOrderId = new Map(materialChecks);

  const checklistByProduct: Record<string, any[]> = {};
  (checklistItems || []).forEach((c: any) => {
    if (!checklistByProduct[c.product_id]) checklistByProduct[c.product_id] = [];
    checklistByProduct[c.product_id].push(c);
  });
  const checkedStepIdsByOrder: Record<string, Set<string>> = {};
  (checklistProgress || []).forEach((p: any) => {
    if (!checkedStepIdsByOrder[p.order_id]) checkedStepIdsByOrder[p.order_id] = new Set();
    checkedStepIdsByOrder[p.order_id].add(p.checklist_item_id);
  });
  const bomByProduct: Record<string, any[]> = {};
  (bomParts || []).forEach((b: any) => {
    if (!bomByProduct[b.product_id]) bomByProduct[b.product_id] = [];
    bomByProduct[b.product_id].push(b);
  });
  const checkedMaterialIdsByOrder: Record<string, Set<string>> = {};
  (materialProgress || []).forEach((p: any) => {
    if (!checkedMaterialIdsByOrder[p.order_id]) checkedMaterialIdsByOrder[p.order_id] = new Set();
    checkedMaterialIdsByOrder[p.order_id].add(p.bom_part_id);
  });
  const photosByOrder: Record<string, any[]> = {};
  (progressPhotos || []).forEach((p: any) => {
    if (!photosByOrder[p.order_id]) photosByOrder[p.order_id] = [];
    photosByOrder[p.order_id].push(p);
  });

  const buildOrders = (orders || []).map((o: any) => {
    const items = itemsByOrder[o.id] || [];
    const scheduledPickup = scheduledPickupByOrderId.get(o.id) || null;
    const materialCheck = materialCheckByOrderId.get(o.id) || { available: true, shortages: [] };

    let totalBuildMinutes = 0;
    items.forEach((it: any) => {
      const perUnit = it.products?.estimated_build_minutes;
      if (perUnit != null) totalBuildMinutes += perUnit * (it.quantity || 1);
    });

    return {
      id: o.id,
      customerName: o.profiles?.full_name || "Unknown",
      isPriorityCustomer: !!o.profiles?.is_priority_customer,
      title: o.title,
      productName: items[0]?.products?.name || o.title,
      sizeDetails: items[0]?.products?.size_details || null,
      productPhotoUrl: items[0]?.products?.image_url || null,
      quantity: items.length > 0 ? items.reduce((sum: number, it: any) => sum + (it.quantity || 1), 0) : 1,
      priority: o.priority,
      dueDate: o.due_date,
      productionDate: o.production_date,
      manualQueuePosition: o.manual_queue_position,
      productionStatus: o.production_status,
      productionNotes: o.production_notes,
      estimatedBuildMinutes: totalBuildMinutes > 0 ? totalBuildMinutes : null,
      materialsAvailable: materialCheck.available,
      scheduledPickupDate: scheduledPickup?.appointment_date || null,
      scheduledPickupTime: scheduledPickup?.appointment_time || null,
      activeSession: activeSessionByOrderId.get(o.id) || null,
      primaryProductId: items[0]?.product_id || null,
      checklistSteps: (items[0]?.product_id ? checklistByProduct[items[0].product_id] : []) || [],
      checkedStepIds: [...(checkedStepIdsByOrder[o.id] || [])],
      materialParts: (items[0]?.product_id ? bomByProduct[items[0].product_id] : []) || [],
      checkedMaterialIds: [...(checkedMaterialIdsByOrder[o.id] || [])],
      photos: photosByOrder[o.id] || []
    };
  });

  const sortedBuildOrders = sortProductionQueue(
    buildOrders.map(o => ({
      ...o,
      hasScheduledPickup: !!o.scheduledPickupDate,
      materialsAvailable: o.materialsAvailable
    }))
  );

  return <ShopFloorView orders={sortedBuildOrders} />;
}
