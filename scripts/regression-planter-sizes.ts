import { toPlanterSizes, formatPrice } from "../src/lib/planterSizes";
const rows = [
  { name: "48x24x30 Cedar Planter Box", price_cents: 7500 },
  { name: "48x18x30 Cedar Planter Box", price_cents: 7500 },
  { name: "36x18x18 Cedar Planter Box", price_cents: 5500 },
  { name: "36x18x24 Cedar Planter Box", price_cents: 6000 },
  { name: "Custom 40x20x20", price_cents: 9000 },
  { name: "36x18x30 Cedar Planter Box", price_cents: null as any }
];
const out = toPlanterSizes(rows);
const keys = out.map(s => s.key).join(",");
if (keys !== "36x18x18,36x18x24,48x18x30") throw new Error("bad: " + keys);
if (formatPrice(5500) !== "$55" || formatPrice(6050) !== "$60.50") throw new Error("price fmt");
console.log("planter sizes ok");
