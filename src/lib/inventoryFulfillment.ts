import { createAdminClient } from "@/lib/supabase/admin";
import { checkStockAndAutoMarkReady } from "@/lib/invoice";

// Orders that are still waiting on finished stock. Cancelled, completed,
// already-ready and already-picked-up orders are never touched.
export const WAITING_STATUSES = ["order_placed", "being_built", "deposit_received", "design_approved", "being_assembled"];

export type ReadyOrder = { id: string; title: string; customerName: string | null };

// After stock is added for a product, finds the OLDEST real (non-demo) order
// that includes that product and is still waiting, and — if everything on that
// order is now in stock — deducts the stock and marks it Ready (the existing
// all-or-nothing rule). Returns the order, or null if none could be filled.
// The customer email is sent by the caller via the existing status route.
export async function markOldestWaitingOrderReady(
  admin: ReturnType<typeof createAdminClient>,
  productId: string
): Promise<ReadyOrder | null> {
  const ids = new Set<string>();
  const { data: itemRows } = await admin.from("order_items").select("order_id").eq("product_id", productId);
  (itemRows || []).forEach((r: any) => ids.add(r.order_id));
  const { data: legacy } = await admin.from("orders").select("id").eq("product_id", productId);
  (legacy || []).forEach((r: any) => ids.add(r.id));
  if (ids.size === 0) return null;

  const { data: orders } = await admin
    .from("orders")
    .select("*, profiles:customer_id(full_name)")
    .in("id", Array.from(ids))
    .in("status", WAITING_STATUSES)
    .eq("is_demo", false)
    .order("created_at", { ascending: true });

  for (const order of (orders || []) as any[]) {
    if (order.stock_deducted) continue;
    await checkStockAndAutoMarkReady(admin, order);
    if (order.stock_deducted) {
      return { id: order.id, title: order.title, customerName: order.profiles?.full_name ?? null };
    }
  }
  return null;
}
