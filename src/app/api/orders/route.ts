import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendOrderStatusEmail } from "@/lib/email";
import { ProductType } from "@/lib/statusSteps";

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: adminProfile } = await supabase.from("profiles").select("role").eq("id", user?.id).single();

  if (adminProfile?.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { customerId, productType, title, sizeDetails, priceCents, quantity, productId } = await req.json();
  if (!customerId || !productType || !title?.trim()) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const initialStatus = "order_placed";

  const { data: order, error } = await supabase
    .from("orders")
    .insert({
      customer_id: customerId,
      product_type: productType,
      title: title.trim(),
      size_details: sizeDetails || null,
      price_cents: Math.round(Number(priceCents) * 100) || 0,
      quantity: Math.max(1, Math.round(Number(quantity)) || 1),
      product_id: productId || null,
      status: initialStatus
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const { data: customer } = await supabase
    .from("profiles")
    .select("email, full_name")
    .eq("id", customerId)
    .single();

  if (customer?.email) {
    try {
      await sendOrderStatusEmail({
        toEmail: customer.email,
        customerName: customer.full_name || "there",
        productType: productType as ProductType,
        orderTitle: order.title,
        orderId: order.id,
        newStatus: initialStatus
      });
    } catch (err) {
      console.error("Order-placed email failed to send:", err);
    }
  }

  return NextResponse.json({ ok: true, order });
}
