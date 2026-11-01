// Year-over-year comparison math (pure, no database). Dates are "YYYY-MM-DD".
import { SALES_TAX_RATE } from "@/lib/tax";

export type SaleRow = { date: string; revenueCents: number; costCents: number };
export type Metric = "sales" | "profit" | "orders";

const pad = (n: number) => String(n).padStart(2, "0");
const toUtc = (s: string) => { const [y, m, d] = s.split("-").map(Number); return Date.UTC(y, m - 1, d); };
const fromUtc = (t: number) => { const d = new Date(t); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; };

export function addDays(s: string, n: number) { return fromUtc(toUtc(s) + n * 86400000); }
export function daysBetween(a: string, b: string) { return Math.round((toUtc(b) - toUtc(a)) / 86400000); }

// Same calendar date one year earlier (Feb 29 → Feb 28).
export function lastYearOf(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  const dim = new Date(Date.UTC(y - 1, m, 0)).getUTCDate();
  return `${y - 1}-${pad(m)}-${pad(Math.min(d, dim))}`;
}

export type Range = { start: string; end: string };

export function valueFor(rows: SaleRow[], r: Range, metric: Metric): number {
  let revenue = 0, cost = 0, count = 0;
  for (const row of rows) {
    if (row.date >= r.start && row.date <= r.end) { revenue += row.revenueCents; cost += row.costCents; count++; }
  }
  return metric === "sales" ? revenue : metric === "profit" ? Math.round(revenue / (1 + SALES_TAX_RATE)) - cost : count;
}

export type CompareRow = { label: string; thisYear: Range; lastYear: Range; thisValue: number; lastValue: number; diff: number; pct: number | null };

function row(rows: SaleRow[], label: string, thisYear: Range, metric: Metric): CompareRow {
  const lastYear = { start: lastYearOf(thisYear.start), end: lastYearOf(thisYear.end) };
  const thisValue = valueFor(rows, thisYear, metric);
  const lastValue = valueFor(rows, lastYear, metric);
  return { label, thisYear, lastYear, thisValue, lastValue, diff: thisValue - lastValue, pct: lastValue !== 0 ? ((thisValue - lastValue) / Math.abs(lastValue)) * 100 : null };
}

export function compareTotal(rows: SaleRow[], range: Range, metric: Metric) { return row(rows, "Total", range, metric); }

// Calendar months touched by the range, each clipped to the range.
export function compareByMonth(rows: SaleRow[], range: Range, metric: Metric): CompareRow[] {
  const out: CompareRow[] = [];
  let [y, m] = range.start.split("-").map(Number);
  const [ey, em] = range.end.split("-").map(Number);
  while (y < ey || (y === ey && m <= em)) {
    const first = `${y}-${pad(m)}-01`;
    const last = `${y}-${pad(m)}-${pad(new Date(Date.UTC(y, m, 0)).getUTCDate())}`;
    const r = { start: first < range.start ? range.start : first, end: last > range.end ? range.end : last };
    const label = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
    out.push(row(rows, label, r, metric));
    m++; if (m > 12) { m = 1; y++; }
  }
  return out;
}

// 7-day blocks counted from the start of the range (Week 1 = first 7 days, ...),
// so last year's block is exactly the same calendar dates.
export function compareByWeek(rows: SaleRow[], range: Range, metric: Metric): CompareRow[] {
  const out: CompareRow[] = [];
  const total = daysBetween(range.start, range.end) + 1;
  for (let k = 0; k * 7 < total; k++) {
    const start = addDays(range.start, k * 7);
    const end = addDays(range.start, Math.min(k * 7 + 6, total - 1));
    out.push(row(rows, `Week ${k + 1}`, { start, end }, metric));
  }
  return out;
}
