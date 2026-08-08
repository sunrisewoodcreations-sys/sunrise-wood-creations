import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: adminProfile } = await supabase.from("profiles").select("role").eq("id", user?.id).single();

  if (adminProfile?.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { error } = await supabase.from("products").delete().eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: adminProfile } = await supabase.from("profiles").select("role").eq("id", user?.id).single();

  if (adminProfile?.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { productType, name, sizeDetails, priceCents, costCents, stockQuantity, lowStockThreshold, picketsPerUnit, estimatedBuildMinutes } = await req.json();
  if (!productType || !name?.trim()) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const { data: existingProduct } = await supabase
    .from("products")
    .select("stock_quantity")
    .eq("id", params.id)
    .maybeSingle();

  const newStock = Math.max(0, Math.round(Number(stockQuantity)) || 0);
  const newThreshold = Math.max(0, Math.round(Number(lowStockThreshold)) || 0);
  const stockChanged = existingProduct && existingProduct.stock_quantity !== newStock;

  // If stock is being manually topped back up above the threshold, reset
  // the alert flag so a future dip below it sends a fresh warning email.
  const updatePayload: any = {
    product_type: productType,
    name: name.trim(),
    size_details: sizeDetails || null,
    price_cents: Math.round(Number(priceCents) * 100) || 0,
    cost_cents: Math.round(Number(costCents) * 100) || 0,
    stock_quantity: newStock,
    low_stock_threshold: newThreshold,
    pickets_per_unit: Math.max(0, Math.round(Number(picketsPerUnit)) || 0),
    estimated_build_minutes: estimatedBuildMinutes?.toString().trim() ? Math.max(0, Math.round(Number(estimatedBuildMinutes))) : null
  };
  if (newStock > newThreshold) {
    updatePayload.low_stock_alert_sent = false;
  }

  const { error } = await supabase
    .from("products")
    .update(updatePayload)
    .eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (stockChanged) {
    await supabase.from("product_stock_adjustments").insert({
      product_id: params.id,
      old_quantity: existingProduct!.stock_quantity,
      new_quantity: newStock,
      reason: "Updated via Products page"
    });
  }

  return NextResponse.json({ ok: true });
}
