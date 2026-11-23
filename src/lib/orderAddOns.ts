// Helpers for adding items to an order that already exists.

export type AddOnItem = {
  productType: string;
  productId: string | null;
  title: string;
  sizeDetails: string | null;
  quantity: number;
  lineTotalCents: number;   // total for this line (unit price x quantity); tax-inclusive unless taxExempt
  taxExempt: boolean;       // no sales tax in this line
};

export function normalizeAddOnItems(raw: any): { ok: true; items: AddOnItem[] } | { ok: false; error: string } {
  if (!Array.isArray(raw) || raw.length === 0) return { ok: false, error: "Add at least one item" };
  if (raw.length > 20) return { ok: false, error: "Too many items at once" };
  const items: AddOnItem[] = [];
  for (const r of raw) {
    const title = typeof r?.title === "string" ? r.title.trim().slice(0, 200) : "";
    if (!title) return { ok: false, error: "Every item needs a name" };
    const quantity = Math.max(1, Math.min(999, Math.round(Number(r?.quantity)) || 1));
    const lineTotalCents = Math.round(Number(r?.priceCents));
    if (!Number.isFinite(lineTotalCents) || lineTotalCents < 0 || lineTotalCents > 100_000_00) {
      return { ok: false, error: `"${title}" needs a valid price` };
    }
    items.push({
      productType: typeof r?.productType === "string" && r.productType ? r.productType : "other",
      productId: typeof r?.productId === "string" && r.productId ? r.productId : null,
      title,
      sizeDetails: typeof r?.sizeDetails === "string" && r.sizeDetails.trim() ? r.sizeDetails.trim().slice(0, 300) : null,
      quantity,
      lineTotalCents,
      taxExempt: r?.taxExempt === true
    });
  }
  return { ok: true, items };
}

// A "real" product line: not the Delivery fee and not a discount. Matches
// how createOrder() builds the order's title, so "X + 2 more items" stays right.
export function isProductLine(title: string, unitPriceCents: number): boolean {
  return unitPriceCents >= 0 && title !== "Delivery fee";
}

// Keeps the "+ N more items" part of the order title in step after items are
// added. A title someone typed by hand (one that isn't the auto-generated
// shape) is left alone.
export function retitleOrder(currentTitle: string, productTitlesInOrder: string[]): string {
  const n = productTitlesInOrder.length;
  if (n === 0) return currentTitle;
  const first = productTitlesInOrder[0];
  const autoShape = new RegExp(`^${first.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?: \\+ \\d+ more items?)?$`);
  if (!autoShape.test(currentTitle)) return currentTitle;
  return n === 1 ? first : `${first} + ${n - 1} more item${n - 1 === 1 ? "" : "s"}`;
}
