import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendReviewRequestEmail } from "@/lib/email";
import { shouldNotify } from "@/lib/notify";

// Asks customers to rate their order about a day after it was picked up or
// delivered. Runs once a day (Vercel cron). Each order is emailed once
// (orders.review_request_sent_at). Only orders that were completed between
// 24 and 72 hours ago are considered, so a missed day is still caught but
// old orders are never emailed. Protected by CRON_SECRET like the others.
export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.sunrisewoodcreations.com";
  const now = Date.now();
  const newest = new Date(now - 24 * 3600000).toISOString();
  const oldest = new Date(now - 72 * 3600000).toISOString();

  const { data: history, error: hErr } = await admin
    .from("order_status_history")
    .select("order_id, created_at")
    .eq("status", "picked_up")
    .lte("created_at", newest)
    .gte("created_at", oldest);
  if (hErr) return NextResponse.json({ error: hErr.message }, { status: 500 });

  const completedAt = new Map<string, string>();
  for (const h of history || []) {
    const prev = completedAt.get(h.order_id);
    if (!prev || h.created_at > prev) completedAt.set(h.order_id, h.created_at);
  }
  const orderIds = Array.from(completedAt.keys());
  if (orderIds.length === 0) return NextResponse.json({ ok: true, sent: 0 });

  const { data: orders, error: oErr } = await admin
    .from("orders")
    .select("id, status, fulfillment_method, is_demo, review_request_sent_at, profiles:customer_id(full_name, email, has_real_email, notify_order_updates)")
    .in("id", orderIds)
    .eq("status", "picked_up")
    .eq("is_demo", false)
    .is("review_request_sent_at", null);
  // If the column hasn't been added yet this errors out and sends nothing.
  if (oErr) return NextResponse.json({ error: oErr.message }, { status: 500 });

  let sent = 0;
  for (const order of orders || []) {
    // Claim the order first so two overlapping runs can't both email it.
    const { data: claimed } = await admin
      .from("orders")
      .update({ review_request_sent_at: new Date().toISOString() })
      .eq("id", order.id)
      .is("review_request_sent_at", null)
      .select("id");
    if (!claimed || claimed.length === 0) continue;

    const customer = (order as any).profiles;
    if (!customer?.email || !shouldNotify(customer, "order_updates")) continue;

    const { data: items } = await admin.from("order_items").select("id, title").eq("order_id", order.id);
    const reviewable = (items || []).filter((i: any) => !/^(delivery fee|coupon:)/i.test(i.title || ""));
    if (reviewable.length === 0) continue;

    const { data: existing } = await admin.from("product_reviews").select("order_item_id").in("order_item_id", reviewable.map((i: any) => i.id));
    const reviewed = new Set((existing || []).map((r: any) => r.order_item_id));
    const toReview = reviewable.filter((i: any) => !reviewed.has(i.id));
    if (toReview.length === 0) continue;

    try {
      await sendReviewRequestEmail({
        toEmail: customer.email,
        customerName: customer.full_name,
        itemTitles: toReview.map((i: any) => i.title),
        reviewUrl: `${siteUrl}/account/reviews`,
        delivered: order.fulfillment_method === "delivery",
        forceDemo: false
      });
      sent++;
    } catch (err) {
      console.error("Review request email failed:", err);
    }
  }

  return NextResponse.json({ ok: true, sent });
}
