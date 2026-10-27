import { createAdminClient } from "@/lib/supabase/admin";
import { sendReviewRequestEmail } from "@/lib/email";
import { shouldNotify } from "@/lib/notify";

// Emails the customer a link to rate their order, right after it is marked
// picked up / delivered. Once per order (orders.review_request_sent_at),
// skips test orders, customers who turned off order emails, and orders with
// nothing left to review. Never throws — the order update has already
// succeeded by the time this runs.
export async function sendReviewRequestForOrder(orderId: string, siteUrl: string): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: order } = await admin
      .from("orders")
      .select("id, status, fulfillment_method, is_demo, review_request_sent_at, profiles:customer_id(full_name, email, has_real_email, notify_order_updates)")
      .eq("id", orderId)
      .maybeSingle();
    if (!order || order.status !== "picked_up" || order.is_demo || order.review_request_sent_at) return;

    // Claim first so two quick clicks can't both email it.
    const { data: claimed } = await admin
      .from("orders")
      .update({ review_request_sent_at: new Date().toISOString() })
      .eq("id", order.id)
      .is("review_request_sent_at", null)
      .select("id");
    if (!claimed || claimed.length === 0) return;

    const customer = (order as any).profiles;
    if (!customer?.email || !shouldNotify(customer, "order_updates")) return;

    const { data: items } = await admin.from("order_items").select("id, title").eq("order_id", order.id);
    const reviewable = (items || []).filter((i: any) => !/^(delivery fee|coupon:)/i.test(i.title || ""));
    if (reviewable.length === 0) return;

    const { data: existing } = await admin.from("product_reviews").select("order_item_id").in("order_item_id", reviewable.map((i: any) => i.id));
    const reviewed = new Set((existing || []).map((r: any) => r.order_item_id));
    const toReview = reviewable.filter((i: any) => !reviewed.has(i.id));
    if (toReview.length === 0) return;

    await sendReviewRequestEmail({
      toEmail: customer.email,
      customerName: customer.full_name,
      itemTitles: toReview.map((i: any) => i.title),
      reviewUrl: `${siteUrl}/account/reviews`,
      delivered: order.fulfillment_method === "delivery",
      forceDemo: false
    });
  } catch (err) {
    console.error("Review request failed:", err);
  }
}
