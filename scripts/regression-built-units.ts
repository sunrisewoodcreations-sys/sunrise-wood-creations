import { recordBuiltUnit, claimShelfUnitsForLine, assignUnitToLine, releaseUnitsFromOrder } from "../src/lib/builtUnits";

function fake(db: Record<string, any[]>) {
  let n = 0;
  return {
    from(t: string) {
      const rows = db[t] || (db[t] = []);
      let lim = Infinity; let mode = "select"; let patch: any = null; const filters: ((r: any) => boolean)[] = [];
      const run = () => {
        const hit = rows.filter(r => filters.every(f => f(r))).slice(0, lim);
        if (mode === "update") hit.forEach(r => Object.assign(r, patch));
        return { data: hit, error: null };
      };
      const b: any = {
        select() { return b; }, order() { return b; }, limit(x: number) { lim = x; return b; },
        eq(c: string, v: any) { filters.push(r => r[c] === v); return b; },
        gt(c: string, v: any) { filters.push(r => r[c] > v); return b; },
        is(c: string, v: any) { filters.push(r => (r[c] ?? null) === v); return b; },
        in(c: string, v: any[]) { filters.push(r => v.includes(r[c])); return b; },
        update(p: any) { mode = "update"; patch = p; return b; },
        insert(r: any) { const row = { id: `id${++n}`, ...r }; rows.push(row); return Object.assign(Promise.resolve({ error: null }), { select() { return { single: () => Promise.resolve({ data: row, error: null }) }; } }); },
        maybeSingle() { return Promise.resolve({ data: run().data[0] ?? null, error: null }); },
        single() { return Promise.resolve({ data: run().data[0] ?? null, error: null }); },
        then(res: any, rej: any) { return Promise.resolve(run()).then(res, rej); }
      };
      return b;
    }
  } as any;
}
let fails = 0;
const t = (name: string, ok: boolean) => { if (!ok) { fails++; console.log("FAIL", name); } else console.log("ok  ", name); };

(async () => {
  const db: any = {
    products: [{ id: "p", pickets_per_unit: 8, cost_cents: 0 }],
    // old pallet: 5 left at $2.00; new pallet: 560 at $3.00
    picket_purchases: [
      { id: "a", remaining_quantity: 5, cost_per_picket_cents: 200, total_cost_cents: 200 * 100, quantity: 100, purchased_at: "2026-01-01", created_at: "1" },
      { id: "b", remaining_quantity: 560, cost_per_picket_cents: 300, total_cost_cents: 300 * 560, quantity: 560, purchased_at: "2026-02-01", created_at: "2" }
    ],
    built_units: [], orders: [{ id: "o", material_cost_cents: null }], order_items: [{ id: "i", order_id: "o", product_id: "p", material_cost_cents: null }]
  };
  const a = fake(db);
  const u1 = await recordBuiltUnit(a, "p");
  t("first piece spans two pallets: 5×$2 + 3×$3 = $19", u1.costCents === 1900);
  t("old pallet emptied, new pallet down 3", db.picket_purchases[0].remaining_quantity === 0 && db.picket_purchases[1].remaining_quantity === 557);
  const u2 = await recordBuiltUnit(a, "p");
  t("second piece all from new pallet: 8×$3 = $24", u2.costCents === 2400 && db.picket_purchases[1].remaining_quantity === 549);
  // Piece 1 built for a customer's order line:
  await assignUnitToLine(a, u1, "o", { kind: "item", id: "i", product_id: "p" });
  t("order line gets piece 1's cost", db.order_items[0].material_cost_cents === 1900 && db.built_units[0].order_id === "o");
  // Piece 2 sat on the shelf, then an order sets it aside:
  await claimShelfUnitsForLine(a, "o", { kind: "item", id: "i", product_id: "p" }, 1);
  t("shelf piece's own cost added later", db.order_items[0].material_cost_cents === 1900 + 2400);
  // Stock with no record is priced at the product's automatic cost.
  db.products[0].cost_cents = 2500;
  await claimShelfUnitsForLine(a, "o", { kind: "item", id: "i", product_id: "p" }, 1);
  t("unrecorded stock uses automatic cost", db.order_items[0].material_cost_cents === 1900 + 2400 + 2500);
  await releaseUnitsFromOrder(a, "o");
  t("deleting order puts pieces back on shelf with their cost", db.built_units.every((x: any) => x.order_id === null) && db.built_units[1].cost_cents === 2400);
  // Not enough pickets logged: piece still counts, warns, nothing taken.
  db.picket_purchases.forEach((p: any) => (p.remaining_quantity = 3));
  const u3 = await recordBuiltUnit(a, "p");
  t("short on pickets → warning, automatic cost, none taken", !!u3.warning && u3.costCents === 2500 && db.picket_purchases[1].remaining_quantity === 3);
  if (fails) { console.log(fails, "failed"); process.exit(1); }
  console.log("All built-unit tests passed.");
})();
