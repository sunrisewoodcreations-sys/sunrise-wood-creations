import { createAdminClient } from "@/lib/supabase/admin";
import { reserveStockForOrder, markOrderReadyIfCovered, reserveBuiltUnitForOrder } from "@/lib/invoice";
import { assignUnitToLine } from "@/lib/builtUnits";

// Orders that are still waiting on finished stock. Cancelled, completed,
// already-ready and already-picked-up orders are never touched.
export const WAITING_STATUSES = ["order_placed", "being_built", "deposit_received", "design_approved", "being_assembled"];

export type ReadyOrder = { id: string; title: string; customerName: string | null };

async function loadOrder(admin: ReturnType<typeof createAdminClient>, id: string) {
  const { data } = await admin.from("orders").select("*, profiles:customer_id(full_name)").eq("id", id).maybeSingle();
  return data as any;
}
const asReady = (o: any): ReadyOrder => ({ id: o.id, title: o.title, customerName: o.profiles?.full_name ?? null });

// A finished piece built FOR a specific customer's order: it is set aside for
// that order (shelf stock does not change). When every piece of that order is
// set aside, the order is marked Ready. Returns { used, ready }.
export async function giveBuiltUnitToOrder(admin: ReturnType<typeof createAdminClient>, orderId: string, productId: string, unit: { id: string | null; costCents: number }) {
  const order = await loadOrder(admin, orderId);
  if (!order || order.stock_deducted || !WAITING_STATUSES.includes(order.status)) return { used: false, ready: null as ReadyOrder | null };
  const line = await reserveBuiltUnitForOrder(admin, order, productId);
  if (!line) return { used: false, ready: null };
  await assignUnitToLine(admin, unit, order.id, { kind: line.kind, id: line.id, product_id: line.product_id });
  const covered = await markOrderReadyIfCovered(admin, order);
  return { used: true, ready: covered ? asReady(order) : null };
}

// A piece added to shelf stock (manual selection): after the stock goes up,
// the OLDEST real (non-demo) order still waiting for that product gets it set
// aside; if that completes the order it is marked Ready.
export async function markOldestWaitingOrderReady(admin: ReturnType<typeof createAdminClient>, productId: string): Promise<ReadyOrder | null> {
  const ids = new Set<string>();
  const { data: itemRows } = await admin.from("order_items").select("order_id").eq("product_id", productId);
  (itemRows || []).forEach((r: any) => ids.add(r.order_id));
  const { data: legacy } = await admin.from("orders").select("id").eq("product_id", productId);
  (legacy || []).forEach((r: any) => ids.add(r.id));
  if (ids.size === 0) return null;

  const { data: orders } = await admin
    .from("orders").select("*, profiles:customer_id(full_name)")
    .in("id", Array.from(ids)).in("status", WAITING_STATUSES).eq("is_demo", false)
    .order("created_at", { ascending: true });

  for (const order of (orders || []) as any[]) {
    if (order.stock_deducted) continue;
    const got = await reserveStockForOrder(admin, order, productId);
    if (!got) continue;
    return (await markOrderReadyIfCovered(admin, order)) ? asReady(order) : null;
  }
  return null;
}
