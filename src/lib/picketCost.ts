import { createAdminClient } from "@/lib/supabase/admin";

type Purchase = { remaining_quantity: number; cost_per_picket_cents: number };

// What the NEXT unit of a product costs in pickets, following the same
// oldest-pallet-first order the site uses when pickets are actually used:
// pickets still left on the current pallet are priced at that pallet's price,
// and once it runs out the rest come from the next pallet's price.
// `fifo` must be oldest first. If there aren't enough pickets logged to cover
// a unit, the shortfall is priced at the newest pallet's price. Returns null
// when no pallet has ever been logged (so we never overwrite a cost with 0).
export function unitCostCents(fifo: Purchase[], allNewestPrice: number | null, pickets: number): number | null {
  if (pickets <= 0) return null;
  let left = pickets;
  let cost = 0;
  for (const p of fifo) {
    if (left <= 0) break;
    if (p.remaining_quantity <= 0) continue;
    const take = Math.min(p.remaining_quantity, left);
    cost += take * p.cost_per_picket_cents;
    left -= take;
  }
  if (left > 0) {
    if (allNewestPrice == null) return null;
    cost += left * allNewestPrice;
  }
  return Math.round(cost);
}

// Keeps every pallet-based product's cost equal to pickets-per-unit × the
// current pallet price. Call after anything that changes pallets or pickets.
export async function syncProductCosts(admin: ReturnType<typeof createAdminClient>): Promise<void> {
  try {
    const { data: purchases } = await admin
      .from("picket_purchases")
      .select("remaining_quantity, cost_per_picket_cents, purchased_at, created_at")
      .order("purchased_at", { ascending: true })
      .order("created_at", { ascending: true });
    const all = (purchases || []) as any[];
    if (all.length === 0) return;
    const newest = all[all.length - 1].cost_per_picket_cents as number;

    const { data: products } = await admin.from("products").select("id, cost_cents, pickets_per_unit").gt("pickets_per_unit", 0);
    for (const p of (products || []) as any[]) {
      const cost = unitCostCents(all, newest, p.pickets_per_unit);
      if (cost != null && cost !== p.cost_cents) {
        await admin.from("products").update({ cost_cents: cost }).eq("id", p.id);
      }
    }
  } catch (err) {
    console.error("Syncing product costs failed:", err);
  }
}
