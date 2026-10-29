import { unitCostCents } from "../src/lib/picketCost";
let fails = 0;
const t = (n: string, ok: boolean) => { if (!ok) { fails++; console.log("FAIL", n); } else console.log("ok  ", n); };
// $1500 / 560 pickets = 268 cents each (rounded as the site stores it); 8 per box.
t("8 × $2.68 = $21.44", unitCostCents([{ remaining_quantity: 560, cost_per_picket_cents: 268 }], 268, 8) === 2144);
// 5 left on the old pallet ($2.00), rest from the new pallet ($3.00).
t("splits across pallets", unitCostCents([{ remaining_quantity: 5, cost_per_picket_cents: 200 }, { remaining_quantity: 500, cost_per_picket_cents: 300 }], 300, 8) === 5 * 200 + 3 * 300);
t("skips empty pallet", unitCostCents([{ remaining_quantity: 0, cost_per_picket_cents: 100 }, { remaining_quantity: 50, cost_per_picket_cents: 300 }], 300, 8) === 2400);
t("short stock priced at newest pallet", unitCostCents([{ remaining_quantity: 3, cost_per_picket_cents: 200 }], 300, 8) === 3 * 200 + 5 * 300);
t("no pallets logged → null", unitCostCents([], null, 8) === null);
t("zero pickets → null", unitCostCents([{ remaining_quantity: 10, cost_per_picket_cents: 200 }], 200, 0) === null);
if (fails) process.exit(1); console.log("All picket-cost tests passed.");
