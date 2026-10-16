// Regression test for the quote -> order conversion bug: a quote's
// coupon discount (coupon_discount_cents) was being silently dropped
// when converting to a real order, because buildOrderItemsFromQuote()
// only read discount_cents back out, never coupon_discount_cents. Fixed
// in src/lib/quote.ts.
//
// This exercises the REAL, unmodified buildOrderItemsFromQuote()
// function from src/lib/quote.ts (not a reimplementation) against a
// minimal fake Supabase admin client, so it catches any future
// regression in the real conversion code, not just in this test file.
//
// No new dependencies: plain Node assertions, run directly with tsx.
//   npx tsx scripts/regression-quote-coupon-conversion.ts
//
// Exit code is non-zero on any failure, so this is also CI-friendly
// even though no CI is currently wired up for it.

import assert from "node:assert/strict";
import { buildOrderItemsFromQuote } from "../src/lib/quote";
import { calculateQuoteTotals } from "../src/lib/tax";

type FakeRow = Record<string, any>;

// Minimal stand-in for the handful of Supabase query-builder methods
// buildOrderItemsFromQuote() actually calls (.select/.eq/.in/.order/
// .maybeSingle) — enough to drive the real function, nothing more.
function makeFakeAdmin(tables: Record<string, FakeRow[] | FakeRow>) {
  return {
    from(table: string) {
      const data = tables[table];
      const chain: any = {
        select: () => chain,
        eq: () => chain,
        in: () => chain,
        order: () => chain,
        maybeSingle: async () => ({ data: Array.isArray(data) ? data[0] ?? null : data ?? null }),
        then: undefined
      };
      // A plain `await admin.from(x).select(...).eq(...)` (no .maybeSingle(),
      // used for quote_items and products) resolves the chain object itself
      // via its thenable — give it a real `.then` so `await` unwraps to
      // { data: [...] } the same way the real client would.
      chain.then = (resolve: any) => resolve({ data: Array.isArray(data) ? data : data ? [data] : [] });
      return chain;
    }
  } as any;
}

const ITEMS = [
  { quantity: 1, unit_price_cents: 15000, title: "Cedar Planter Box" }, // $150.00
  { quantity: 2, unit_price_cents: 2500, title: "Small Sign" }   // 2x $25.00
];
const ITEMS_FOR_TOTALS = ITEMS.map(it => ({ quantity: it.quantity, unitPriceCents: it.unit_price_cents }));

async function runScenario(label: string, discountCents: number, deliveryCents: number, couponId: string | null, couponDiscountCents: number | null) {
  const expected = calculateQuoteTotals(ITEMS_FOR_TOTALS, discountCents, deliveryCents, couponDiscountCents || 0);

  const admin = makeFakeAdmin({
    quotes: {
      discount_cents: discountCents,
      delivery_cents: deliveryCents,
      coupon_id: couponId,
      coupon_discount_cents: couponDiscountCents
    },
    quote_items: ITEMS.map(it => ({ ...it, product_id: null })),
    products: [],
    coupons: couponId ? { code: "TESTCODE10" } : []
  });

  const orderItems = await buildOrderItemsFromQuote(admin, "fake-quote-id");
  assert.ok(orderItems, `${label}: expected order items, got null`);

  const reconstructedTotal = orderItems!.reduce((sum, it) => sum + it.priceCents, 0);

  assert.equal(
    reconstructedTotal,
    expected.totalCents,
    `${label}: reconstructed order total ($${(reconstructedTotal / 100).toFixed(2)}) did not match the quoted total ($${(expected.totalCents / 100).toFixed(2)})`
  );

  // A coupon-discount line item must actually be present (and negative)
  // whenever a coupon was applied — not just "the math happens to add
  // up," but a visible, auditable line on the resulting order/invoice.
  if (couponDiscountCents && couponDiscountCents > 0) {
    const couponLine = orderItems!.find(it => it.title.startsWith("Coupon:"));
    assert.ok(couponLine, `${label}: expected a visible "Coupon: ..." line item`);
    assert.equal(couponLine!.priceCents, -couponDiscountCents, `${label}: coupon line item amount is wrong`);
  }

  console.log(`PASS  ${label} — order total $${(reconstructedTotal / 100).toFixed(2)} matches quoted total`);
}

async function main() {
  await runScenario("No discounts at all", 0, 1000, null, null);
  await runScenario("Manual discount only", 2000, 1000, null, null);
  await runScenario("Coupon only (the bug's exact case)", 0, 1000, "coupon-123", 1500);
  await runScenario("Manual discount AND coupon together", 2000, 1000, "coupon-123", 1500);
  console.log("\nAll quote -> order conversion regression scenarios passed.");
}

main().catch(err => {
  console.error("\nREGRESSION TEST FAILED:", err.message);
  process.exit(1);
});
