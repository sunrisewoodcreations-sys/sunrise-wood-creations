import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: adminProfile } = await supabase.from("profiles").select("role").eq("id", user?.id).single();

  if (adminProfile?.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { customerId, productType, title, sizeDetails, priceCents } = await req.json();

  if (!customerId || !productType || !title?.trim()) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const initialStatus = productType === "cornhole" ? "deposit_received" : "order_placed";

  const { data: order, error } = await supabase
    .from("orders")
    .insert({
      customer_id: customerId,
      product_type: productType,
      title: title.trim(),
      size_details: sizeDetails || null,
      price_cents: Math.round(Number(priceCents) * 100) || 0,
      status: initialStatus
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, order });
}
