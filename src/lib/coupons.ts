import { createAdminClient } from "@/lib/supabase/admin";
import { ProductType } from "@/lib/statusSteps";

export type CouponLineItemInput = {
  productType: ProductType | string;
  productId?: string | null;
  quantity: number;
  unitPriceCentsInclusive: number;
};

export type CouponRow = {
  id: string;
  campaign_id: string | null;
  code: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  applies_to_type: "all" | "product_type" | "product";
  applies_to_value: string | null;
  min_purchase_cents: number | null;
  max_discount_cents: number | null;
  starts_at: string | null;
  expires_at: string | null;
  max_total_redemptions: number | null;
  max_redemptions_per_customer: number;
  combinable: boolean;
  is_active: boolean;
};

export type CouponValidationResult =
  | { valid: true; coupon: CouponRow; discountCents: number; eligibleAmountCents: number }
  | { valid: false; error: string };

// The one place every rule from the coupon builder is actually enforced.
// Called server-side only (from the quote/order coupon-apply API route) —
// never trust a client-computed discount amount.
export async function validateAndCalculateCoupon(opts: {
  code: string;
  customerId: string;
  items: CouponLineItemInput[];
  existingManualDiscountCents?: number;
}): Promise<CouponValidationResult> {
  const admin = createAdminClient();
  const code = opts.code.trim().toUpperCase();
  if (!code) return { valid: false, error: "Enter a coupon code." };

  const { data: coupon } = await admin
    .from("coupons")
    .select("*")
    .ilike("code", code)
    .single();

  if (!coupon) return { valid: false, error: "That coupon code doesn't exist." };
  if (!coupon.is_active) return { valid: false, error: "That coupon is no longer active." };

  const now = new Date();
  if (coupon.starts_at && new Date(coupon.starts_at) > now) {
    return { valid: false, error: `This coupon isn't active yet — it starts ${new Date(coupon.starts_at).toLocaleDateString()}.` };
  }
  if (coupon.expires_at && new Date(coupon.expires_at) < now) {
    return { valid: false, error: `This coupon expired on ${new Date(coupon.expires_at).toLocaleDateString()}.` };
  }

  if (!coupon.combinable && (opts.existingManualDiscountCents || 0) > 0) {
    return { valid: false, error: "This coupon can't be combined with an existing manual discount. Remove the manual discount first." };
  }

  // Redemption limits — enforced against the real, existing redemptions
  // table, never a client-supplied count.
  if (coupon.max_total_redemptions != null) {
    const { count: totalRedemptions } = await admin
      .from("coupon_redemptions")
      .select("id", { count: "exact", head: true })
      .eq("coupon_id", coupon.id);
    if ((totalRedemptions || 0) >= coupon.max_total_redemptions) {
      return { valid: false, error: "This coupon has reached its total redemption limit." };
    }
  }

  const { count: customerRedemptions } = await admin
    .from("coupon_redemptions")
    .select("id", { count: "exact", head: true })
    .eq("coupon_id", coupon.id)
    .eq("customer_id", opts.customerId);
  if ((customerRedemptions || 0) >= coupon.max_redemptions_per_customer) {
    return { valid: false, error: "This customer has already used this coupon the maximum number of times." };
  }

  // Eligibility — which line items this coupon actually applies to.
  const eligibleItems = opts.items.filter(item => {
    if (coupon.applies_to_type === "all") return true;
    if (coupon.applies_to_type === "product_type") return item.productType === coupon.applies_to_value;
    if (coupon.applies_to_type === "product") return item.productId === coupon.applies_to_value;
    return false;
  });
  const eligibleAmountCents = eligibleItems.reduce((sum, it) => sum + it.unitPriceCentsInclusive * (it.quantity || 1), 0);

  if (eligibleAmountCents === 0) {
    return { valid: false, error: "This coupon doesn't apply to anything in this order." };
  }

  const orderTotalCents = opts.items.reduce((sum, it) => sum + it.unitPriceCentsInclusive * (it.quantity || 1), 0);
  if (coupon.min_purchase_cents != null && orderTotalCents < coupon.min_purchase_cents) {
    return { valid: false, error: `This coupon requires a minimum purchase of $${(coupon.min_purchase_cents / 100).toFixed(2)}.` };
  }

  const discountCents = calculateCouponDiscountCents(coupon, eligibleAmountCents);

  return { valid: true, coupon, discountCents, eligibleAmountCents };
}

// Pure calculation, no DB access — reused by validateAndCalculateCoupon
// above and safe to unit-test or call from anywhere the eligible amount
// is already known.
export function calculateCouponDiscountCents(coupon: Pick<CouponRow, "discount_type" | "discount_value" | "max_discount_cents">, eligibleAmountCents: number): number {
  let discount = coupon.discount_type === "percentage"
    ? Math.round((eligibleAmountCents * coupon.discount_value) / 100)
    : coupon.discount_value;
  discount = Math.min(discount, eligibleAmountCents);
  if (coupon.max_discount_cents != null) discount = Math.min(discount, coupon.max_discount_cents);
  return Math.max(0, discount);
}

// Records that a coupon was actually used — called once, at the moment a
// quote/order the coupon was applied to becomes real (quote sent/accepted,
// or order created), never duplicated for the same order.
export async function recordCouponRedemption(opts: {
  couponId: string;
  customerId: string;
  orderId?: string;
  quoteId?: string;
  discountAppliedCents: number;
}) {
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("coupon_redemptions")
    .select("id")
    .eq("coupon_id", opts.couponId)
    .eq(opts.orderId ? "order_id" : "quote_id", opts.orderId || opts.quoteId)
    .maybeSingle();
  if (existing) return; // Already recorded — never double-count the same order/quote.

  await admin.from("coupon_redemptions").insert({
    coupon_id: opts.couponId,
    customer_id: opts.customerId,
    order_id: opts.orderId || null,
    quote_id: opts.quoteId || null,
    discount_applied_cents: opts.discountAppliedCents
  });
}

// Simple, readable, collision-checked code generator for the "Generate"
// button in the campaign builder — not cryptographic, just needs to be
// memorable and not already in use.
export async function generateUniqueCouponCode(prefix: string): Promise<string> {
  const admin = createAdminClient();
  const base = prefix.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 12) || "SAVE";
  for (let attempt = 0; attempt < 20; attempt++) {
    const suffix = attempt === 0 ? "" : String(Math.floor(10 + Math.random() * 90));
    const candidate = `${base}${suffix}`;
    const { data } = await admin.from("coupons").select("id").ilike("code", candidate).maybeSingle();
    if (!data) return candidate;
  }
  return `${base}${Date.now().toString().slice(-6)}`;
}
