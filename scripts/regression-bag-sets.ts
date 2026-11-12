import { normalizeBagSets, bagLineTitle, MAX_BAG_SETS, proofTitleFromItems } from "../src/lib/bagSets";
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
t(proofTitleFromItems(["Michigan flag", "Cornhole bags — Set of 8"], "Michigan flag + 1 more item") === "Michigan flag", "proof names only the boards, not the bags");
t(proofTitleFromItems(["Michigan flag", "Cornhole bags — Set of 8", "Delivery fee"], "x") === "Michigan flag", "delivery fee is left out too");
t(proofTitleFromItems(["Flag A", "Flag B", "Cornhole bags — Set of 4"], "x") === "Flag A + 1 more item", "two boards still count");
t(proofTitleFromItems(["Cornhole bags — Set of 4"], "Fallback") === "Fallback", "nothing but bags falls back to the order title");
t(proofTitleFromItems([], "Order title") === "Order title", "no items falls back to the order title");
process.exit(bad ? 1 : 0);
