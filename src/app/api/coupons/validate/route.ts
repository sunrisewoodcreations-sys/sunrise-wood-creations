import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validateAndCalculateCoupon, CouponLineItemInput } from "@/lib/coupons";

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user?.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const body = await req.json();
  const { code, customerId, items, existingManualDiscountCents } = body as {
    code: string; customerId: string; items: CouponLineItemInput[]; existingManualDiscountCents?: number;
  };

  if (!code || !customerId || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "Coupon code, customer, and at least one line item are required." }, { status: 400 });
  }

  const result = await validateAndCalculateCoupon({ code, customerId, items, existingManualDiscountCents });
  if (!result.valid) return NextResponse.json({ error: result.error }, { status: 400 });

  return NextResponse.json({
    valid: true,
    couponId: result.coupon.id,
    code: result.coupon.code,
    discountCents: result.discountCents,
    eligibleAmountCents: result.eligibleAmountCents
  });
}
