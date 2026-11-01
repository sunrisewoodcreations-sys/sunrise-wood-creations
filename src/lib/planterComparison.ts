// Per-item (planter size) sales comparison between a date range and the
// exact same dates one year earlier. Pure functions, dates are "YYYY-MM-DD".
import { lastYearOf, type Range } from "./yoy";

export type ItemSale = { date: string; name: string; qty: number; revenueCents: number };
export type SizeRow = {
  name: string;
  thisQty: number; lastQty: number; qtyDiff: number;
  thisCents: number; lastCents: number; centsDiff: number;
  pct: number | null; // sales change vs last year; null when last year had no sales
};

export function lastYearRange(r: Range): Range {
  return { start: lastYearOf(r.start), end: lastYearOf(r.end) };
}

function totals(rows: ItemSale[], r: Range) {
  const m = new Map<string, { qty: number; cents: number }>();
  for (const x of rows) {
    if (x.date < r.start || x.date > r.end) continue;
    const t = m.get(x.name) || { qty: 0, cents: 0 };
    t.qty += x.qty; t.cents += x.revenueCents;
    m.set(x.name, t);
  }
  return m;
}

export function compareBySize(rows: ItemSale[], range: Range): SizeRow[] {
  const cur = totals(rows, range);
  const prev = totals(rows, lastYearRange(range));
  const names = new Set([...cur.keys(), ...prev.keys()]);
  const out: SizeRow[] = [];
  names.forEach(name => {
    const c = cur.get(name) || { qty: 0, cents: 0 };
    const p = prev.get(name) || { qty: 0, cents: 0 };
    out.push({
      name,
      thisQty: c.qty, lastQty: p.qty, qtyDiff: c.qty - p.qty,
      thisCents: c.cents, lastCents: p.cents, centsDiff: c.cents - p.cents,
      pct: p.cents > 0 ? ((c.cents - p.cents) / p.cents) * 100 : null
    });
  });
  return out.sort((a, b) => b.thisCents - a.thisCents || b.lastCents - a.lastCents || a.name.localeCompare(b.name));
}
