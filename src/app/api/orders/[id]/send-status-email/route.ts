import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendOrderStatusEmail } from "@/lib/email";
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
    .select("*, profiles:customer_id(email, full_name)")
    .eq("id", params.id)
    .single();

  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const customer = (order as any).profiles;
  const balanceDueCents = order.status === "ready_for_pickup"
    ? (order.price_cents || 0) - (order.amount_paid_cents || 0)
    : undefined;

  try {
    await sendOrderStatusEmail({
      toEmail: customer.email,
      customerName: customer.full_name,
      productType: order.product_type as ProductType,
      orderTitle: order.title,
      orderId: order.id,
      newStatus: order.status,
      balanceDueCents
    });
  } catch (err) {
    console.error("Manual status email failed:", err);
    return NextResponse.json({ error: "Email failed to send" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
