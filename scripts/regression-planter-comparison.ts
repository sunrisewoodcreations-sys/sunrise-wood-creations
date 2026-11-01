import { compareBySize, lastYearRange } from "../src/lib/planterComparison";
let fails = 0;
const t = (n: string, ok: boolean) => { console.log(ok ? "ok  " : "FAIL", n); if (!ok) fails++; };
const rows = [
  { date: "2026-10-10", name: "48x18x30", qty: 1, revenueCents: 7000 },
  { date: "2025-10-11", name: "48x18x30", qty: 1, revenueCents: 6500 },
  { date: "2026-10-12", name: "36x18x30", qty: 2, revenueCents: 12000 },
  { date: "2025-10-15", name: "24x12x20", qty: 3, revenueCents: 9000 },
  { date: "2025-09-30", name: "48x18x30", qty: 5, revenueCents: 50000 },
  { date: "2026-11-01", name: "48x18x30", qty: 5, revenueCents: 50000 },
];
const r = compareBySize(rows, { start: "2026-10-01", end: "2026-10-31" });
const by = (n: string) => r.find(x => x.name === n)!;
t("last-year range", JSON.stringify(lastYearRange({ start: "2026-10-01", end: "2026-10-31" })) === '{"start":"2025-10-01","end":"2025-10-31"}');
t("out-of-range dates ignored", by("48x18x30").thisCents === 7000 && by("48x18x30").lastCents === 6500);
t("up %", Math.round(by("48x18x30").pct!) === 8 && by("48x18x30").centsDiff === 500);
t("new size has null pct", by("36x18x30").pct === null && by("36x18x30").lastCents === 0);
t("size sold only last year shows down", by("24x12x20").thisQty === 0 && by("24x12x20").centsDiff === -9000 && by("24x12x20").pct === -100);
t("sorted by sales", r[0].name === "36x18x30");
if (fails) process.exit(1); console.log("All planter comparison tests passed.");
