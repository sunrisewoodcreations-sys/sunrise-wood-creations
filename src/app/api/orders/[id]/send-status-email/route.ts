import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendOrderStatusEmail } from "@/lib/email";
import { shouldNotify } from "@/lib/notify";
import { getOrCreatePickupSchedulingUrl } from "@/lib/pickupScheduling";
import { ProductType } from "@/lib/statusSteps";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: adminProfile } = await supabase.from("profiles").select("role").eq("id", user?.id).single();

  if (adminProfile?.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { data: order } = await supabase
    .from("orders")
    .select("*, profiles:customer_id(email, full_name, has_real_email, notify_order_updates)")
    .eq("id", params.id)
    .single();

  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const customer = (order as any).profiles;

  if (!shouldNotify(customer, "order_updates")) {
    return NextResponse.json({ error: "This customer has opted out of order update emails (or has no email on file)." }, { status: 400 });
  }

  const balanceDueCents = order.status === "ready_for_pickup"
    ? (order.price_cents || 0) - (order.amount_paid_cents || 0)
    : undefined;

  // A "ready" email always carries the schedule button (whether or not the
  // balance is paid) unless the customer already has an active appointment.
  let schedulingUrl: string | undefined;
  if (order.status === "ready_for_pickup") {
    try {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || `https://${req.headers.get("host")}`;
      const r = await getOrCreatePickupSchedulingUrl(order.id, siteUrl, { force: true });
      if (r.ok) schedulingUrl = r.url;
    } catch (err) {
      console.error("Scheduling link for resend failed:", err);
    }
  }

  try {
    await sendOrderStatusEmail({
      toEmail: customer.email,
      customerName: customer.full_name,
      productType: order.product_type as ProductType,
      orderTitle: order.title,
      orderId: order.id,
      newStatus: order.status,
      fulfillmentMethod: (order as any).fulfillment_method,
      balanceDueCents,
      schedulingUrl,
      schedulingKind: (order as any).fulfillment_method === "delivery" ? "delivery" : "pickup"
    });
  } catch (err) {
    console.error("Manual status email failed:", err);
    return NextResponse.json({ error: "Email failed to send" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
