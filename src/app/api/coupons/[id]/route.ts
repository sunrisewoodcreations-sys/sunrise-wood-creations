import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function requireAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user?.id).single();
  return profile?.role === "admin";
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const admin = createAdminClient();
  const { data: campaign } = await admin.from("campaigns").select("*, coupons(*)").eq("id", params.id).single();
  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

  const coupon = Array.isArray(campaign.coupons) ? campaign.coupons[0] : campaign.coupons;

  const { data: recipients } = await admin
    .from("campaign_recipients")
    .select("*, profiles:customer_id(full_name, email)")
    .eq("campaign_id", params.id)
    .order("created_at", { ascending: true });

  // Redemptions + revenue — both derived from the real, existing orders
  // table via the redemption's order_id, never a separately tracked figure.
  const { data: redemptions } = coupon
    ? await admin
        .from("coupon_redemptions")
        .select("*, profiles:customer_id(full_name, email), orders:order_id(id, title, price_cents)")
        .eq("coupon_id", coupon.id)
        .order("redeemed_at", { ascending: false })
    : { data: [] as any[] };

  const revenueGeneratedCents = (redemptions || []).reduce((sum: number, r: any) => sum + (r.orders?.price_cents || 0), 0);

  return NextResponse.json({
    campaign,
    coupon,
    recipients: recipients || [],
    redemptions: redemptions || [],
    revenueGeneratedCents
  });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const admin = createAdminClient();
  const { data: campaign } = await admin.from("campaigns").select("status").eq("id", params.id).single();
  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

  const body = await req.json();

  // Cancelling a scheduled campaign — the only edit allowed once a
  // campaign is no longer a draft, so a campaign that already started
  // sending can never be silently rewritten mid-send.
  if (body.action === "cancel") {
    if (campaign.status !== "scheduled") {
      return NextResponse.json({ error: "Only a scheduled campaign can be cancelled." }, { status: 400 });
    }
    await admin.from("campaigns").update({ status: "cancelled" }).eq("id", params.id);
    return NextResponse.json({ ok: true });
  }

  if (campaign.status !== "draft") {
    return NextResponse.json({ error: "Only a draft campaign can be edited." }, { status: 400 });
  }

  const campaignFields: Record<string, any> = {};
  ["name", "targeting_type", "targeting_value", "exclude_previously_sent", "email_subject", "email_heading", "email_body"].forEach(key => {
    const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    if (body[camelKey] !== undefined) campaignFields[key] = body[camelKey];
  });
  if (Object.keys(campaignFields).length > 0) {
    campaignFields.updated_at = new Date().toISOString();
    await admin.from("campaigns").update(campaignFields).eq("id", params.id);
  }

  const couponFields: Record<string, any> = {};
  [
    ["discountType", "discount_type"], ["discountValue", "discount_value"],
    ["appliesToType", "applies_to_type"], ["appliesToValue", "applies_to_value"],
    ["minPurchaseCents", "min_purchase_cents"], ["maxDiscountCents", "max_discount_cents"],
    ["startsAt", "starts_at"], ["expiresAt", "expires_at"],
    ["maxTotalRedemptions", "max_total_redemptions"], ["maxRedemptionsPerCustomer", "max_redemptions_per_customer"],
    ["combinable", "combinable"], ["isActive", "is_active"]
  ].forEach(([camelKey, dbKey]) => {
    if (body[camelKey] !== undefined) couponFields[dbKey] = body[camelKey];
  });
  if (Object.keys(couponFields).length > 0) {
    await admin.from("coupons").update(couponFields).eq("campaign_id", params.id);
  }

  return NextResponse.json({ ok: true });
}
