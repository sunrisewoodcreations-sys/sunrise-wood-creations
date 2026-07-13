import { createAdminClient } from "@/lib/supabase/admin";

type ConsumeResult =
  | { ok: true; totalCostCents: number }
  | { ok: false; error: string };

// Consumes `quantityNeeded` pickets from inventory, oldest purchase first
// (FIFO), and returns the actual cost based on what was really paid for
// each one. If a pallet only has a few pickets left, it uses those at
// that pallet's price, then moves on to the next pallet for the rest —
// exactly like the "5 left on the old pallet, 3 from the new one" example.
// Also records exactly which pallet(s) the order drew from, so deleting
// that order later can add the exact right amount back to the exact
// right pallet.
export async function consumePicketsFifo(
  admin: ReturnType<typeof createAdminClient>,
  quantityNeeded: number,
  orderId: string,
  orderItemId?: string
): Promise<ConsumeResult> {
  if (quantityNeeded <= 0) {
    return { ok: false, error: "Pickets used must be a positive number." };
  }

  const { data: purchases, error } = await admin
    .from("picket_purchases")
    .select("id, remaining_quantity, cost_per_picket_cents")
    .gt("remaining_quantity", 0)
    .order("purchased_at", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) return { ok: false, error: error.message };

  const totalAvailable = (purchases || []).reduce((sum, p) => sum + p.remaining_quantity, 0);
  if (totalAvailable < quantityNeeded) {
    return {
      ok: false,
      error: `Only ${totalAvailable} pickets in inventory, but ${quantityNeeded} were used. Log a purchase first.`
    };
  }

  let remaining = quantityNeeded;
  let totalCostCents = 0;
  const updates: { id: string; newRemaining: number }[] = [];
  const allocations: { purchase_id: string; quantity: number }[] = [];

  for (const purchase of purchases || []) {
    if (remaining <= 0) break;
    const takeFromThis = Math.min(purchase.remaining_quantity, remaining);
    totalCostCents += takeFromThis * purchase.cost_per_picket_cents;
    remaining -= takeFromThis;
    updates.push({ id: purchase.id, newRemaining: purchase.remaining_quantity - takeFromThis });
    allocations.push({ purchase_id: purchase.id, quantity: takeFromThis });
  }

  // Only write the updates once we know the whole allocation succeeded.
  for (const u of updates) {
    await admin.from("picket_purchases").update({ remaining_quantity: u.newRemaining }).eq("id", u.id);
  }

  if (allocations.length > 0) {
    await admin.from("picket_usage_allocations").insert(
      allocations.map(a => ({
        order_id: orderId,
        order_item_id: orderItemId || null,
        purchase_id: a.purchase_id,
        quantity: a.quantity
      }))
    );
  }

  return { ok: true, totalCostCents };
}
