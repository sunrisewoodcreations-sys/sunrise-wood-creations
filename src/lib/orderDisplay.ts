import { productLabel, ProductType } from "./statusSteps";

// Customer-facing display helpers for orders. Everything here is pure
// formatting: it never reads or writes the database, and nothing in the
// app identifies or looks up an order by what these functions return.
// The internal order id (a UUID) remains the one real identifier for
// links, lookups, invoices, payments, and every other table.

// "SWC-1001" for a real order, "DEMO-3" for a demo/test order (demo
// orders have their own separate counter in the database, so they never
// use up a real customer's number). Returns null for anything that isn't
// a clearly valid number + a clearly boolean demo flag, so a caller can
// leave the line out instead of ever showing a wrong or misleading label.
export function formatOrderNumber(orderNumber: unknown, isDemo: unknown): string | null {
  if (typeof orderNumber !== "number" || !Number.isInteger(orderNumber) || orderNumber < 1) return null;
  if (isDemo === false) return `SWC-${orderNumber}`;
  if (isDemo === true) return `DEMO-${orderNumber}`;
  return null;
}

// Admin order search: does what was typed match this order's number?
// Accepts "SWC-1004", "swc1004", "#SWC-1004", or just "1004" (and the
// DEMO- equivalents). Exact match only, on purpose, so typing "10" does
// not match every order numbered 10xx. The admin search keeps its
// existing matching on customer, title, and order id as well, so old
// 8-character codes still find their order.
export function matchesOrderNumberQuery(query: string, orderNumber: unknown, isDemo: unknown): boolean {
  const display = formatOrderNumber(orderNumber, isDemo);
  if (!display) return false;
  const q = String(query || "").trim().toLowerCase().replace(/^#/, "").replace(/\s+/g, "");
  if (!q) return false;
  const shown = display.toLowerCase();
  return q === shown || q === shown.replace("-", "") || q === String(orderNumber);
}

// Matches the "+ 1 more item" / "+ 3 more items" tail that
// createOrder() appends to a multi-item order's title.
const MORE_ITEMS_SUFFIX = /\s\+\s\d+\smore\sitems?$/;

// The product line shown in the "Your Order" box of order-status emails.
//
// Display-only: the stored order title and the product's name are never
// changed, and the website, admin, and invoices keep showing them exactly
// as before. Only planters are changed, because those are the only
// products whose names already say what they are:
//   "36x18x30 Cedar Planter Box"  ->  "36x18x30 Cedar Planter"
//   "36x18x18 Cedar Planter Box + 1 more item"  ->  "36x18x18 Cedar Planter + 1 more item"
// A planter whose name does not say "planter" (for example
// "36x18x15 With Trellis") keeps its "Planter box —" label, since
// without it the line would not say what the item is. Every other
// product type returns exactly what the email showed before.
export function emailProductName(title: string, productType: string): string {
  const raw = String(title ?? "").trim();
  const label = productLabel(productType as ProductType);
  if (productType !== "planter" || !raw) return `${label} — ${raw}`;

  const suffixMatch = raw.match(MORE_ITEMS_SUFFIX);
  const suffix = suffixMatch ? suffixMatch[0] : "";
  const main = (suffixMatch ? raw.slice(0, raw.length - suffix.length) : raw).trim();

  // Only a trailing "Planter Box" loses its "Box". A name like "Herb Box"
  // is left alone (and keeps its label below).
  const cleaned = main.replace(/(\bplanter)\s+box$/i, "$1");

  if (/\bplanter/i.test(cleaned)) return `${cleaned}${suffix}`;
  return `${label} — ${main}${suffix}`;
}
