import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateUniqueCouponCode } from "@/lib/coupons";

async function requireAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("role, id").eq("id", user?.id).single();
  return profile?.role === "admin" ? { supabase, adminId: profile.id } : null;
}

export async function GET() {
  const auth = await requireAdmin();
  if (!auth) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const admin = createAdminClient();
  const { data: campaigns } = await admin
    .from("campaigns")
    .select("*, coupons(*)")
    .order("created_at", { ascending: false });

  // Recipient/sent/redeemed counts computed per campaign from the real
  // recipients and redemptions tables — not stored/duplicated on the
  // campaign row itself, so they're always accurate.
  const campaignIds = (campaigns || []).map((c: any) => c.id);
  const [{ data: allRecipients }, { data: allRedemptions }] = await Promise.all([
    campaignIds.length > 0
      ? admin.from("campaign_recipients").select("campaign_id, email_sent_at").in("campaign_id", campaignIds)
      : Promise.resolve({ data: [] as any[] }),
    campaignIds.length > 0
      ? admin.from("coupon_redemptions").select("coupon_id, discount_applied_cents")
      : Promise.resolve({ data: [] as any[] })
  ]);

  const result = (campaigns || []).map((c: any) => {
    const recipients = (allRecipients || []).filter((r: any) => r.campaign_id === c.id);
    const coupon = Array.isArray(c.coupons) ? c.coupons[0] : c.coupons;
    const redemptions = coupon ? (allRedemptions || []).filter((r: any) => r.coupon_id === coupon.id) : [];
    return {
      ...c,
      coupon,
      recipientCount: recipients.length,
      sentCount: recipients.filter((r: any) => r.email_sent_at).length,
      redeemedCount: redemptions.length
    };
  });

  return NextResponse.json({ campaigns: result });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const body = await req.json();
  const {
    name, couponCode, autoGenerateCode, discountType, discountValue,
    appliesToType, appliesToValue, minPurchaseCents, maxDiscountCents,
    startsAt, expiresAt, maxTotalRedemptions, maxRedemptionsPerCustomer,
    combinable, targetingType, targetingValue, excludePreviouslySent,
    emailSubject, emailHeading, emailBody
  } = body;

  if (!name?.trim()) return NextResponse.json({ error: "Campaign name is required" }, { status: 400 });
  if (!discountType || discountValue == null) return NextResponse.json({ error: "Discount type and amount are required" }, { status: 400 });

  const admin = createAdminClient();

  const code = autoGenerateCode
    ? await generateUniqueCouponCode(name)
    : (couponCode || "").trim().toUpperCase();
  if (!code) return NextResponse.json({ error: "Coupon code is required" }, { status: 400 });

  const { data: existing } = await admin.from("coupons").select("id").ilike("code", code).maybeSingle();
  if (existing) return NextResponse.json({ error: `Coupon code "${code}" is already in use.` }, { status: 400 });

  const { data: campaign, error: campaignError } = await admin
    .from("campaigns")
    .insert({
      name: name.trim(),
      email_subject: emailSubject || "",
      email_heading: emailHeading || "",
      email_body: emailBody || "",
      targeting_type: targetingType || "all",
      targeting_value: targetingValue || {},
      exclude_previously_sent: excludePreviouslySent !== false,
      status: "draft",
      created_by: auth.adminId
    })
    .select()
    .single();

  if (campaignError || !campaign) {
    return NextResponse.json({ error: campaignError?.message || "Couldn't create the campaign" }, { status: 400 });
  }

  const { data: coupon, error: couponError } = await admin
    .from("coupons")
    .insert({
      campaign_id: campaign.id,
      code,
      discount_type: discountType,
      discount_value: discountValue,
      applies_to_type: appliesToType || "all",
      applies_to_value: appliesToValue || null,
      min_purchase_cents: minPurchaseCents || null,
      max_discount_cents: maxDiscountCents || null,
      starts_at: startsAt || null,
      expires_at: expiresAt || null,
      max_total_redemptions: maxTotalRedemptions || null,
      max_redemptions_per_customer: maxRedemptionsPerCustomer || 1,
      combinable: !!combinable,
      is_active: true
    })
    .select()
    .single();

  if (couponError || !coupon) {
    // Roll back the campaign row so a failed coupon insert never leaves
    // an orphaned campaign with no coupon behind it.
    await admin.from("campaigns").delete().eq("id", campaign.id);
    return NextResponse.json({ error: couponError?.message || "Couldn't create the coupon" }, { status: 400 });
  }

  return NextResponse.json({ campaign, coupon });
}
