// Cornhole bag sets you can add to a cornhole order ("Set of 4", "Set of 8", ...).
// Stored in the existing site_settings row (data.bagSets) — no database change.
export interface BagSet {
  label: string;
  priceCents: number;
}

export const MAX_BAG_SETS = 12;

export function normalizeBagSets(raw: any): BagSet[] {
  if (!Array.isArray(raw)) return [];
  const out: BagSet[] = [];
  for (const r of raw) {
    const label = typeof r?.label === "string" ? r.label.trim().slice(0, 60) : "";
    const cents = Math.round(Number(r?.priceCents));
    if (!label || !Number.isFinite(cents) || cents < 0 || cents > 10_000_000) continue;
    out.push({ label, priceCents: cents });
    if (out.length >= MAX_BAG_SETS) break;
  }
  return out;
}

// The text that shows on the order and invoice line.
export function bagLineTitle(set: BagSet): string {
  return `Cornhole bags — ${set.label}`;
}
