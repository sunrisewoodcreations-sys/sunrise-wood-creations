import { normalizeBagSets, bagLineTitle, MAX_BAG_SETS } from "../src/lib/bagSets";
let bad = 0;
const t = (ok: boolean, m: string) => { if (!ok) bad++; console.log((ok ? "PASS " : "FAIL ") + m); };

const n = normalizeBagSets([
  { label: "  Set of 4 ", priceCents: 2500.4 },
  { label: "", priceCents: 1000 },
  { label: "Bad price", priceCents: -5 },
  { label: "Junk", priceCents: "abc" },
  { label: "Set of 8", priceCents: 4000 }
]);
t(n.length === 2, "blank names, negative and non-numeric prices are dropped");
t(n[0].label === "Set of 4" && n[0].priceCents === 2500, "labels trimmed, prices rounded to whole cents");
t(normalizeBagSets(undefined).length === 0 && normalizeBagSets("x").length === 0, "missing/garbage settings = no bag sets");
t(normalizeBagSets(Array.from({ length: 30 }, (_, i) => ({ label: "S" + i, priceCents: 100 }))).length === MAX_BAG_SETS, "capped at the max");
t(bagLineTitle({ label: "Set of 8", priceCents: 4000 }) === "Cornhole bags — Set of 8", "order/invoice line title");
process.exit(bad ? 1 : 0);
