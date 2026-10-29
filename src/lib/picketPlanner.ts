// Picket Planner — "I have N pickets. What can I build from them?"
//
// Pure calculation, no database access: it takes products with their parts
// lists (the same product_bom_parts data the Cut List Generator uses) and a
// number of pickets, and works out how many of each product fit. All the
// actual board packing is done by the existing, already-tested optimizer
// (optimizeByMaterial in cutlistOptimizer.ts), so the numbers match what the
// Cut List Generator would produce for the same parts.
//
// How a plan is built:
//   1. The person says how many pickets they have and picks products, each
//      with a "ratio" (1 : 1 : 1 by default, or e.g. 2 : 1 for twice as many
//      of the first).
//   2. We find the largest number of full "sets" (one set = ratio-many of each
//      product) whose combined cut list fits in the pickets.
//   3. Leftover pickets and offcuts are then used for extra units, one at a
//      time, as long as another unit still fits.
//   4. The combined cut list for the final quantities is returned.

import {
  BOMPart,
  OptimizationResult,
  mergeParts,
  optimizeByMaterial
} from "@/lib/cutlistOptimizer";

// Cedar is the material that comes from pickets (see materialPlanning.ts,
// where "cedar" is the one material with a real picket inventory).
export const PICKET_MATERIAL = "cedar";
export const DEFAULT_BOARD_LENGTH = 71; // same stock length the Cut List Generator uses
export const DEFAULT_KERF = 0.125;
// Safety valve so a part list with tiny pieces can't make the search huge.
const MAX_SETS_SEARCH = 5000;

export type PlannerProduct = { id: string; name: string; parts: BOMPart[] };
export type PlanRequest = { id: string; ratio: number };

export type CutMeasure = {
  picketsUsed: number;
  normalResults: OptimizationResult[];
  trimResults: OptimizationResult[];
};

export type PlanLine = {
  id: string;
  name: string;
  ratio: number;
  plannedUnits: number; // from full sets
  extraUnits: number;   // squeezed out of leftover pickets and offcuts
  totalUnits: number;
  aloneMax: number;     // how many if ALL pickets went to just this product
};

export type OtherMaterial = { materialType: string; parts: { partName: string; length: number; quantity: number }[] };

export type Plan = {
  picketsAvailable: number;
  picketsUsed: number;
  picketsLeft: number;
  boardLength: number;
  kerf: number;
  sets: number;
  lines: PlanLine[];
  normalResults: OptimizationResult[];
  trimResults: OptimizationResult[];
  otherMaterials: OtherMaterial[];
  excluded: { id: string; name: string; reason: string }[];
};

export function isPicketMaterial(materialType: string): boolean {
  return materialType.trim().toLowerCase() === PICKET_MATERIAL;
}

function scale(parts: BOMPart[], qty: number): BOMPart[] {
  return parts.map(p => ({ ...p, quantityPerUnit: p.quantityPerUnit * qty }));
}

function cedarInchesPerUnit(parts: BOMPart[]): number {
  return parts.filter(p => isPicketMaterial(p.materialType)).reduce((s, p) => s + p.length * p.quantityPerUnit, 0);
}

// Packs the picket (cedar) parts for the given quantities. Every cedar part
// is treated as the same stock regardless of how "Cedar" was capitalised, so
// they pack onto the same pickets; trim parts stay on their own boards, never
// mixed with standard parts, exactly like the Cut List Generator.
export function measureCutList(
  products: PlannerProduct[],
  counts: Record<string, number>,
  boardLength: number,
  kerf: number
): CutMeasure {
  const lists = products
    .filter(p => (counts[p.id] || 0) > 0)
    .map(p => scale(
      p.parts.filter(part => isPicketMaterial(part.materialType)).map(part => ({ ...part, materialType: "Cedar" })),
      counts[p.id]
    ));
  const merged = mergeParts(lists);
  const normalResults = optimizeByMaterial(merged.filter(p => !p.isTrim), boardLength, kerf);
  const trimResults = optimizeByMaterial(merged.filter(p => p.isTrim), boardLength, kerf);
  const picketsUsed =
    normalResults.reduce((s, r) => s + r.totalBoards, 0) + trimResults.reduce((s, r) => s + r.totalBoards, 0);
  return { picketsUsed, normalResults, trimResults };
}

function hasOversizedCedarPart(product: PlannerProduct, boardLength: number): boolean {
  return product.parts.some(p => isPicketMaterial(p.materialType) && p.length > boardLength);
}

// Largest k such that `fits(k)` is true, for k in [0, upper]. Packing is a
// heuristic and not guaranteed perfectly monotonic, so after the binary
// search we also look a few steps past the answer.
function largestFitting(upper: number, fits: (k: number) => boolean): number {
  let lo = 0;
  let hi = upper;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (fits(mid)) lo = mid;
    else hi = mid - 1;
  }
  for (let k = lo + 1; k <= Math.min(upper, lo + 3); k++) {
    if (fits(k)) lo = k;
  }
  return lo;
}

export function planFromPickets(
  allProducts: PlannerProduct[],
  requests: PlanRequest[],
  picketCount: number,
  boardLength: number = DEFAULT_BOARD_LENGTH,
  kerf: number = DEFAULT_KERF
): Plan {
  const excluded: Plan["excluded"] = [];
  const chosen: { product: PlannerProduct; ratio: number }[] = [];

  for (const req of requests) {
    const product = allProducts.find(p => p.id === req.id);
    if (!product || !(req.ratio > 0)) continue;
    if (cedarInchesPerUnit(product.parts) <= 0) {
      excluded.push({ id: product.id, name: product.name, reason: "No cedar parts on its parts list, so pickets don't limit it." });
    } else if (hasOversizedCedarPart(product, boardLength)) {
      excluded.push({ id: product.id, name: product.name, reason: `A cedar part is longer than the ${boardLength}" stock length, so it can't be cut from these pickets.` });
    } else {
      chosen.push({ product, ratio: Math.floor(req.ratio) });
    }
  }
  const usable = chosen.filter(c => c.ratio >= 1);
  const products = usable.map(c => c.product);

  const cache = new Map<string, CutMeasure>();
  const measure = (counts: Record<string, number>) => {
    const key = products.map(p => `${p.id}:${counts[p.id] || 0}`).join("|");
    let m = cache.get(key);
    if (!m) { m = measureCutList(products, counts, boardLength, kerf); cache.set(key, m); }
    return m;
  };
  const fitsCounts = (counts: Record<string, number>) => measure(counts).picketsUsed <= picketCount;

  const maxUnitsAlone = (product: PlannerProduct): number => {
    const perUnit = cedarInchesPerUnit(product.parts);
    const upper = Math.min(MAX_SETS_SEARCH, Math.floor((picketCount * boardLength) / perUnit));
    return largestFitting(upper, k => fitsCounts({ [product.id]: k }));
  };

  const counts: Record<string, number> = {};
  products.forEach(p => { counts[p.id] = 0; });
  let sets = 0;

  if (products.length > 0 && picketCount > 0) {
    const inchesPerSet = usable.reduce((s, c) => s + c.ratio * cedarInchesPerUnit(c.product.parts), 0);
    const upper = Math.min(MAX_SETS_SEARCH, Math.floor((picketCount * boardLength) / inchesPerSet));
    sets = largestFitting(upper, k => {
      const trial: Record<string, number> = {};
      usable.forEach(c => { trial[c.product.id] = c.ratio * k; });
      return fitsCounts(trial);
    });
    usable.forEach(c => { counts[c.product.id] = c.ratio * sets; });
  }

  const planned: Record<string, number> = { ...counts };

  // Use up what's left over: add one more unit of any chosen product while it
  // still fits, going round the list until nothing more fits.
  if (products.length > 0 && picketCount > 0) {
    let added = true;
    let guard = 0;
    while (added && guard++ < 10000) {
      added = false;
      for (const p of products) {
        const trial = { ...counts, [p.id]: counts[p.id] + 1 };
        if (fitsCounts(trial)) { counts[p.id] += 1; added = true; }
      }
    }
  }

  const final = products.length > 0 && picketCount > 0
    ? measure(counts)
    : { picketsUsed: 0, normalResults: [], trimResults: [] };

  const lines: PlanLine[] = usable.map(c => ({
    id: c.product.id,
    name: c.product.name,
    ratio: c.ratio,
    plannedUnits: planned[c.product.id] || 0,
    extraUnits: (counts[c.product.id] || 0) - (planned[c.product.id] || 0),
    totalUnits: counts[c.product.id] || 0,
    aloneMax: picketCount > 0 ? maxUnitsAlone(c.product) : 0
  }));

  // Everything that is NOT picket material, totalled for the chosen quantities,
  // so the plan also says what else needs buying (it doesn't limit the plan).
  const other = new Map<string, Map<string, { partName: string; length: number; quantity: number }>>();
  for (const p of products) {
    const n = counts[p.id] || 0;
    if (n === 0) continue;
    for (const part of p.parts) {
      if (isPicketMaterial(part.materialType)) continue;
      const mat = part.materialType.trim() || "Other";
      const byPart = other.get(mat) || new Map();
      const key = `${part.partName}:${part.length}`;
      const existing = byPart.get(key);
      if (existing) existing.quantity += part.quantityPerUnit * n;
      else byPart.set(key, { partName: part.partName, length: part.length, quantity: part.quantityPerUnit * n });
      other.set(mat, byPart);
    }
  }
  const otherMaterials: OtherMaterial[] = Array.from(other.entries()).map(([materialType, byPart]) => ({
    materialType,
    parts: Array.from(byPart.values())
  }));

  return {
    picketsAvailable: picketCount,
    picketsUsed: final.picketsUsed,
    picketsLeft: Math.max(0, picketCount - final.picketsUsed),
    boardLength,
    kerf,
    sets,
    lines,
    normalResults: final.normalResults,
    trimResults: final.trimResults,
    otherMaterials,
    excluded
  };
}
