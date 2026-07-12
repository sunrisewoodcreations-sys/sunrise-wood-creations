import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: adminProfile } = await supabase.from("profiles").select("role").eq("id", user?.id).single();

  if (adminProfile?.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { productType, name, sizeDetails, priceCents, costCents, stockQuantity, lowStockThreshold } = await req.json();
  if (!productType || !name?.trim()) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const { data: product, error } = await supabase
    .from("products")
    .insert({
      product_type: productType,
      name: name.trim(),
      size_details: sizeDetails || null,
      price_cents: Math.round(Number(priceCents) * 100) || 0,
      cost_cents: Math.round(Number(costCents) * 100) || 0,
      stock_quantity: Math.max(0, Math.round(Number(stockQuantity)) || 0),
      low_stock_threshold: Math.max(0, Math.round(Number(lowStockThreshold)) || 0)
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, product });
}
