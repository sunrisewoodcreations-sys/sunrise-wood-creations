import { reserveStockForOrder, markOrderReadyIfCovered, reserveBuiltUnitForOrder, releaseReservedStock } from "../src/lib/invoice";

// Minimal in-memory stand-in for the Supabase admin client.
function fake(db: Record<string, any[]>) {
  return {
    from(t: string) {
      let rows = db[t] || (db[t] = []);
      let lim = Infinity; let mode = "select"; let patch: any = null; const filters: ((r: any) => boolean)[] = [];
      const run = () => {
        const hit = rows.filter(r => filters.every(f => f(r))).slice(0, lim);
        if (mode === "update") { hit.forEach(r => Object.assign(r, patch)); return { data: hit, error: null }; }
        return { data: hit, error: null };
      };
      const b: any = {
        select() { return b; }, order() { return b; },
        eq(c: string, v: any) { filters.push(r => r[c] === v); return b; },
        is(c: string, v: any) { filters.push(r => (r[c] ?? null) === v); return b; },
        limit(n: number) { lim = n; return b; },
        in(c: string, v: any[]) { filters.push(r => v.includes(r[c])); return b; },
        update(p: any) { mode = "update"; patch = p; return b; },
        insert(r: any) { rows.push(r); return Promise.resolve({ error: null }); },
        maybeSingle() { return Promise.resolve({ data: run().data[0] ?? null, error: null }); },
        single() { return Promise.resolve({ data: run().data[0] ?? null, error: null }); },
        then(res: any) { return Promise.resolve(run()).then(res); }
      };
      return b;
    }
  } as any;
}
let fails = 0;
const t = (name: string, ok: boolean) => { if (!ok) { fails++; console.log("FAIL", name); } else console.log("ok  ", name); };

(async () => {
  // Order of 3, 2 on hand: 2 set aside now, stock 0, order NOT ready, 1 left to build.
  let db: any = { products: [{ id: "p", stock_quantity: 2, low_stock_threshold: 0, low_stock_alert_sent: true, name: "P" }], orders: [{ id: "o", title: "T", status: "order_placed", stock_deducted: false }], order_items: [{ id: "i", order_id: "o", product_id: "p", quantity: 3, stock_reserved_qty: 0 }], product_stock_adjustments: [] };
  let a = fake(db); const order = db.orders[0];
  t("reserve takes what's on hand", await reserveStockForOrder(a, order));
  t("stock shows 0", db.products[0].stock_quantity === 0);
  t("2 of 3 reserved", db.order_items[0].stock_reserved_qty === 2);
  t("not ready with 1 still to build", !(await markOrderReadyIfCovered(a, order)) && order.status === "order_placed");
  t("adjustment logged", db.product_stock_adjustments.length === 1);
  // Build the last piece for this customer: no shelf change, order becomes ready.
  t("built unit goes to order", !!(await reserveBuiltUnitForOrder(a, order, "p")));
  t("now ready", await markOrderReadyIfCovered(a, order) && order.status === "ready_for_pickup" && order.stock_deducted === true);
  t("shelf stock still 0", db.products[0].stock_quantity === 0);
  t("no more to give", !(await reserveBuiltUnitForOrder(a, order, "p")));
  // Deleting returns reserved stock.
  await releaseReservedStock(a, order);
  t("delete returns 3 to shelf", db.products[0].stock_quantity === 3);
  // Fully covered at creation.
  db = { products: [{ id: "p", stock_quantity: 5, low_stock_threshold: 2, name: "P" }], orders: [{ id: "o", title: "T", status: "order_placed" }], order_items: [{ id: "i", order_id: "o", product_id: "p", quantity: 2, stock_reserved_qty: 0 }], product_stock_adjustments: [] };
  a = fake(db); const o2 = db.orders[0];
  await reserveStockForOrder(a, o2);
  t("fully covered → ready, stock 3", await markOrderReadyIfCovered(a, o2) && db.products[0].stock_quantity === 3);
  // Older order (fully deducted, no per-line count) and a delivered order.
  db = { products: [{ id: "p", stock_quantity: 0, name: "P" }], orders: [{ id: "o", title: "T", status: "ready_for_pickup", stock_deducted: true }, { id: "d", title: "D", status: "picked_up", stock_deducted: true }], order_items: [{ id: "i", order_id: "o", product_id: "p", quantity: 2, stock_reserved_qty: 0 }, { id: "j", order_id: "d", product_id: "p", quantity: 4, stock_reserved_qty: 0 }], product_stock_adjustments: [] };
  a = fake(db);
  await releaseReservedStock(a, db.orders[0]);
  t("older ready order returns full qty", db.products[0].stock_quantity === 2);
  await releaseReservedStock(a, db.orders[1]);
  t("picked-up order returns nothing", db.products[0].stock_quantity === 2);
  if (fails) { console.log(fails, "failed"); process.exit(1); }
  console.log("All stock-reservation tests passed.");
})();
