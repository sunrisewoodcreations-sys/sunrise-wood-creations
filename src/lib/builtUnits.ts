import { createAdminClient } from "@/lib/supabase/admin";
import { takePicketsFifo } from "@/lib/pickets";

type Admin = ReturnType<typeof createAdminClient>;
export type Line = { kind: "item" | "order"; id: string; product_id: string };

// A piece was just built: take its pickets out of inventory now (oldest pallet
// first) and remember what they cost. If there aren't enough pickets logged,
// the piece still counts, priced at the product's automatic cost, and a warning
// comes back so it can be shown.
export async function recordBuiltUnit(admin: Admin, productId: string): Promise<{ id: string | null; costCents: number; warning?: string }> {
  const { data: product } = await admin.from("products").select("pickets_per_unit, cost_cents").eq("id", productId).maybeSingle();
  const per = (product as any)?.pickets_per_unit || 0;
  let costCents = (product as any)?.cost_cents || 0;
  let allocations: any[] = [];
  let warning: string | undefined;
  if (per > 0) {
    const r = await takePicketsFifo(admin, per);
    if (r.ok) { costCents = r.totalCostCents; allocations = r.allocations; }
    else warning = "Not enough pickets are logged, so none were taken out. Log your pallet and adjust the count.";
  }
  const { data, error } = await admin.from("built_units")
    .insert({ product_id: productId, cost_cents: costCents, pickets_used: allocations.length ? per : 0, allocations })
    .select("id").single();
  if (error) console.error("Recording built unit failed:", error.message);
  return { id: (data as any)?.id ?? null, costCents, warning };
}

async function addCostToLine(admin: Admin, line: Line, cents: number) {
  if (cents === 0) return;
  const table = line.kind === "item" ? "order_items" : "orders";
  const { data } = await admin.from(table).select("material_cost_cents").eq("id", line.id).maybeSingle();
  await admin.from(table).update({ material_cost_cents: ((data as any)?.material_cost_cents || 0) + cents }).eq("id", line.id);
}

// A specific built piece goes to a specific order line: its cost becomes that line's material cost.
export async function assignUnitToLine(admin: Admin, unit: { id: string | null; costCents: number }, orderId: string, line: Line) {
  if (unit.id) {
    await admin.from("built_units").update({ order_id: orderId, order_item_id: line.kind === "item" ? line.id : null }).eq("id", unit.id);
  }
  await addCostToLine(admin, line, unit.costCents);
}

// `count` pieces come off the shelf for an order: the oldest unclaimed built
// pieces are used (their real pallet cost). Any piece with no record (stock
// that existed before this tracking) is priced at the product's automatic cost.
export async function claimShelfUnitsForLine(admin: Admin, orderId: string, line: Line, count: number) {
  if (count <= 0) return;
  const { data: units } = await admin.from("built_units").select("id, cost_cents")
    .eq("product_id", line.product_id).is("order_id", null).order("built_at", { ascending: true }).limit(count);
  let cents = 0;
  for (const u of (units || []) as any[]) {
    cents += u.cost_cents || 0;
    await admin.from("built_units").update({ order_id: orderId, order_item_id: line.kind === "item" ? line.id : null }).eq("id", u.id);
  }
  const short = count - (units || []).length;
  if (short > 0) {
    const { data: product } = await admin.from("products").select("cost_cents").eq("id", line.product_id).maybeSingle();
    cents += short * ((product as any)?.cost_cents || 0);
  }
  await addCostToLine(admin, line, cents);
}

// An order was deleted and its pieces go back on the shelf: they become
// unclaimed again, keeping their cost (the pickets stay used — the pieces exist).
export async function releaseUnitsFromOrder(admin: Admin, orderId: string) {
  await admin.from("built_units").update({ order_id: null, order_item_id: null }).eq("order_id", orderId);
}

// Stock was reduced on the Products page: remove that many pieces from the
// shelf (newest built first) and put their pickets back on the pallets they came
// from. Only pieces with a record can give pickets back; returns how many did.
export async function removeShelfUnits(admin: Admin, productId: string, count: number): Promise<number> {
  if (count <= 0) return 0;
  const { data: units } = await admin.from("built_units").select("id, allocations")
    .eq("product_id", productId).is("order_id", null).order("built_at", { ascending: false }).limit(count);
  let removed = 0;
  for (const u of (units || []) as any[]) {
    for (const a of (u.allocations || []) as { purchase_id: string; quantity: number }[]) {
      const { data: p } = await admin.from("picket_purchases").select("remaining_quantity, quantity").eq("id", a.purchase_id).maybeSingle();
      if (!p) continue; // that pallet was deleted
      const back = Math.min((p as any).quantity, (p as any).remaining_quantity + a.quantity);
      await admin.from("picket_purchases").update({ remaining_quantity: back }).eq("id", a.purchase_id);
    }
    await admin.from("built_units").delete().eq("id", u.id);
    removed++;
  }
  return removed;
}
