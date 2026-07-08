import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendOrderStatusEmail } from "@/lib/email";
import { ProductType } from "@/lib/statusSteps";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: adminProfile } = await supabase.from("profiles").select("role").eq("id", user?.id).single();

  if (adminProfile?.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { status } = await req.json();

  const { data: order, error } = await supabase
    .from("orders")
    .update({ status })
    .eq("id", params.id)
    .select("*, profiles:customer_id(email, full_name)")
    .single();

  if (error || !order) {
    return NextResponse.json({ error: error?.message || "Order not found" }, { status: 400 });
  }

  const customer = (order as any).profiles;

  await sendOrderStatusEmail({
    toEmail: customer.email,
    customerName: customer.full_name,
    productType: order.product_type as ProductType,
    orderTitle: order.title,
    orderId: order.id,
    newStatus: status
  });

  return NextResponse.json({ ok: true });
}
