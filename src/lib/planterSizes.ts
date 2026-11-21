import { createAdminClient } from "@/lib/supabase/admin";

// The six standard planter sizes shown publicly. Anything else in the
// products table (e.g. one-off custom sizes) is deliberately never listed.
export const STANDARD_PLANTER_SIZES = [
  "36x18x18", "36x18x24", "36x18x30", "48x18x18", "48x18x24", "48x18x30"
] as const;

export type PlanterSize = {
  key: string;            // "36x18x18"
  label: string;          // "36 × 18 × 18"
  length: number;
  width: number;
  height: number;
  priceCents: number;     // tax-inclusive, straight from products.price_cents
};

export function parsePlanterName(name: string): string | null {
  const m = /^\s*(\d+)\s*x\s*(\d+)\s*x\s*(\d+)\b/i.exec(name);
  return m ? `${m[1]}x${m[2]}x${m[3]}` : null;
}

export function formatPrice(cents: number): string {
  const d = cents / 100;
  return `$${Number.isInteger(d) ? d.toFixed(0) : d.toFixed(2)}`;
}

export function toPlanterSizes(rows: { name: string; price_cents: number | null }[]): PlanterSize[] {
  const byKey = new Map<string, PlanterSize>();
  for (const r of rows) {
    const key = parsePlanterName(r.name || "");
    if (!key || !(STANDARD_PLANTER_SIZES as readonly string[]).includes(key)) continue;
    if (typeof r.price_cents !== "number" || r.price_cents <= 0) continue;
    const [length, width, height] = key.split("x").map(Number);
    byKey.set(key, { key, label: `${length} × ${width} × ${height}`, length, width, height, priceCents: r.price_cents });
  }
  return STANDARD_PLANTER_SIZES.filter(k => byKey.has(k)).map(k => byKey.get(k)!);
}

// Live prices: read straight from the products table every time the page
// renders, so changing a price in the admin changes the website.
// Failure returns [] so the page still renders (just without the price list).
export async function getPlanterSizes(): Promise<PlanterSize[]> {
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("products").select("name, price_cents").eq("product_type", "planter");
    return toPlanterSizes((data as any[]) || []);
  } catch {
    return [];
  }
}
