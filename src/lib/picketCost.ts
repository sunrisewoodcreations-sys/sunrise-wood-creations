import { createAdminClient } from "@/lib/supabase/admin";
import { sendPicketLowAlert } from "@/lib/email";

export const PICKET_LOW_THRESHOLD = 50;

type Purchase = { remaining_quantity: number; cost_per_picket_cents: number; total_cost_cents?: number; quantity?: number };

// Exact per-picket price: pallet total ÷ pallet size (falls back to the stored rounded price).
export const exactPicketPrice = (p: Purchase) => (p.quantity && p.total_cost_cents != null ? p.total_cost_cents / p.quantity : p.cost_per_picket_cents);

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
    cost += take * exactPicketPrice(p);
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
      .select("remaining_quantity, cost_per_picket_cents, total_cost_cents, quantity, purchased_at, created_at")
      .order("purchased_at", { ascending: true })
      .order("created_at", { ascending: true });
    const all = (purchases || []) as any[];
    if (all.length === 0) return;
    const newest = exactPicketPrice(all[all.length - 1]);

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

// Emails once when total pickets across ALL pallets fall to the alert line
// (so a second logged pallet suppresses it), and re-arms when stock is
// replenished above the line. Safe to call after anything that changes pallets.
export async function checkPicketLowAlert(admin: ReturnType<typeof createAdminClient>): Promise<void> {
  try {
    const { data, error } = await admin.from("picket_purchases").select("id, remaining_quantity, low_alert_sent");
    if (error || !data || data.length === 0) return; // column missing / nothing logged yet
    const total = data.reduce((s: number, p: any) => s + (p.remaining_quantity || 0), 0);
    if (total > PICKET_LOW_THRESHOLD) {
      if (data.some((p: any) => p.low_alert_sent)) {
        await admin.from("picket_purchases").update({ low_alert_sent: false }).eq("low_alert_sent", true);
      }
      return;
    }
    if (data.some((p: any) => p.low_alert_sent)) return; // already told you about this dip
    await sendPicketLowAlert({ remaining: total, threshold: PICKET_LOW_THRESHOLD });
    await admin.from("picket_purchases").update({ low_alert_sent: true }).in("id", data.map((p: any) => p.id));
  } catch (err) {
    console.error("Picket low alert failed:", err);
  }
}
