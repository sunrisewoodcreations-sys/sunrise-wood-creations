import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createOrder, IncomingOrderItem } from "@/lib/orders";
import { recordCouponRedemption } from "@/lib/coupons";

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: adminProfile } = await supabase.from("profiles").select("role, is_demo_account").eq("id", user?.id).single();

  if (adminProfile?.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const body = await req.json();
  const { customerId, dueDate, couponId, couponDiscountCents } = body;

  if (!customerId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  let items: IncomingOrderItem[];

  if (Array.isArray(body.items) && body.items.length > 0) {
    items = body.items;
  } else {
    const { productType, title, sizeDetails, priceCents, quantity, productId } = body;
    if (!productType || !title?.trim()) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    items = [{ productType, productId, title, sizeDetails, quantity, priceCents }];
  }

  if (items.some(it => !it.productType || !it.title?.trim())) {
    return NextResponse.json({ error: "Every item needs a product type and title" }, { status: 400 });
  }

  const result = await createOrder({ customerId, dueDate, items, isDemo: !!adminProfile?.is_demo_account });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  // If a coupon was applied, record the redemption against this exact
  // real order and carry the reference onto the order itself — same
  // pattern already used when a quote-with-coupon becomes an order.
  if (couponId) {
    const admin = createAdminClient();
    await admin.from("orders").update({ coupon_id: couponId, coupon_discount_cents: couponDiscountCents || 0 }).eq("id", result.order.id);
    await recordCouponRedemption({
      couponId,
      customerId,
      orderId: result.order.id,
      discountAppliedCents: couponDiscountCents || 0
    });
  }

  return NextResponse.json({ ok: true, order: result.order });
}
