// Single source of truth for the sales tax rate and the tax-inclusive
// "back out the tax" calculation already used by invoices — extracted
// here so the new Quotes system can use the exact same convention
// (prices entered are tax-inclusive, matching how orders are already
// priced) instead of a second, different tax model.
export const SALES_TAX_RATE = 0.06; // Michigan

// Given a tax-inclusive total, returns the pre-tax subtotal and the
// tax portion — same math already used in invoice.ts, just named and
// shared so it's never re-derived differently in a second place.
export function backOutTax(inclusiveCents: number): { subtotalCents: number; taxCents: number } {
  const subtotalCents = Math.round(inclusiveCents / (1 + SALES_TAX_RATE));
  return { subtotalCents, taxCents: inclusiveCents - subtotalCents };
}

// Shared by both the server (creating/saving a quote) and the client
// (showing live totals while editing) — kept in this dependency-free
// file specifically so client components can import it without risking
// pulling in quote.ts's server-only pdf-lib/admin-client code.
export type QuoteLineItemForTotals = { quantity: number; unitPriceCents: number };
export function calculateQuoteTotals(items: QuoteLineItemForTotals[], discountCents: number, deliveryCents: number) {
  const itemsTotalCents = items.reduce((sum, it) => sum + it.unitPriceCents * (it.quantity || 1), 0);
  const afterDiscountCents = Math.max(0, itemsTotalCents - discountCents);
  const { subtotalCents, taxCents } = backOutTax(afterDiscountCents);
  const totalCents = afterDiscountCents + deliveryCents;
  return { subtotalCents, taxCents, totalCents, itemsTotalCents };
}
