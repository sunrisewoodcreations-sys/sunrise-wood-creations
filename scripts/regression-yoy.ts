import { lastYearOf, compareByMonth, compareByWeek, compareTotal, addDays, SaleRow } from "../src/lib/yoy";
let fails = 0;
const t = (n: string, ok: boolean) => { if (!ok) { fails++; console.log("FAIL", n); } else console.log("ok  ", n); };
t("same date last year", lastYearOf("2026-10-31") === "2025-10-31");
t("Feb 29 → Feb 28", lastYearOf("2028-02-29") === "2027-02-28");
const rows: SaleRow[] = [
  { date: "2026-01-05", revenueCents: 10000, costCents: 4000 },
  { date: "2026-01-20", revenueCents: 5000, costCents: 2000 },
  { date: "2026-02-03", revenueCents: 7000, costCents: 3000 },
  { date: "2025-01-06", revenueCents: 8000, costCents: 3000 },
  { date: "2025-02-10", revenueCents: 9000, costCents: 3500 },
  { date: "2025-03-01", revenueCents: 99999, costCents: 0 }, // outside the compared dates
];
const range = { start: "2026-01-01", end: "2026-02-15" };
const total = compareTotal(rows, range, "sales");
t("total this year", total.thisValue === 22000);
t("total last year same dates only", total.lastValue === 17000 && total.lastYear.end === "2025-02-15");
t("difference + percent", total.diff === 5000 && Math.round(total.pct!) === 29);
const months = compareByMonth(rows, range, "sales");
t("two months, Feb clipped to range", months.length === 2 && months[1].thisYear.end === "2026-02-15" && months[1].lastYear.end === "2025-02-15");
t("month values", months[0].thisValue === 15000 && months[0].lastValue === 8000 && months[1].thisValue === 7000 && months[1].lastValue === 9000);
const weeks = compareByWeek(rows, range, "sales");
t("46 days → 7 weeks, last is short", weeks.length === 7 && weeks[6].thisYear.start === addDays("2026-01-01", 42) && weeks[6].thisYear.end === "2026-02-15");
t("week sums equal total", weeks.reduce((s, w) => s + w.thisValue, 0) === 22000 && weeks.reduce((s, w) => s + w.lastValue, 0) === 17000);
t("profit metric excludes 6% sales tax", compareTotal(rows, range, "profit").thisValue === Math.round(22000 / 1.06) - 9000);
t("orders metric", compareTotal(rows, range, "orders").thisValue === 3);
t("no last-year data → pct null", compareTotal([rows[0]], range, "sales").pct === null);
if (fails) process.exit(1); console.log("All year-over-year tests passed.");
