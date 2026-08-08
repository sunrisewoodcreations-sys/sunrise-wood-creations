import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Duplicates a product AND its parts list in one step — so a size
// variant (e.g. 36x18x18 -> 36x18x24) doesn't require retyping every
// part from scratch, just adjusting the new copy's name/size/lengths.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: adminProfile } = await supabase.from("profiles").select("role").eq("id", user?.id).single();

  if (adminProfile?.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { data: source, error: sourceError } = await supabase
    .from("products")
    .select("*")
    .eq("id", params.id)
    .single();

  if (sourceError || !source) {
    return NextResponse.json({ error: "Original product not found" }, { status: 404 });
  }

  const { data: sourceParts } = await supabase
    .from("product_bom_parts")
    .select("*")
    .eq("product_id", params.id)
    .order("sort_order", { ascending: true });

  const { data: newProduct, error: insertError } = await supabase
    .from("products")
    .insert({
      product_type: source.product_type,
      name: `${source.name} (copy)`,
      size_details: source.size_details,
      price_cents: source.price_cents,
      cost_cents: source.cost_cents,
      stock_quantity: 0,
      low_stock_threshold: source.low_stock_threshold,
      pickets_per_unit: source.pickets_per_unit
    })
    .select()
    .single();

  if (insertError || !newProduct) {
    return NextResponse.json({ error: insertError?.message || "Couldn't create the duplicate" }, { status: 400 });
  }

  if (sourceParts && sourceParts.length > 0) {
    const newRows = sourceParts.map((p: any) => ({
      product_id: newProduct.id,
      part_name: p.part_name,
      length_inches: p.length_inches,
      final_length_inches: p.final_length_inches,
      quantity_per_unit: p.quantity_per_unit,
      material_type: p.material_type,
      is_trim: p.is_trim,
      grain_direction: p.grain_direction,
      sort_order: p.sort_order
    }));

    const { error: partsError } = await supabase.from("product_bom_parts").insert(newRows);
    if (partsError) {
      // The product itself was created successfully — surface the parts
      // error but don't roll back the product, since it can still be
      // edited manually if the parts copy failed for some reason.
      return NextResponse.json({ ok: true, product: newProduct, warning: `Product duplicated, but copying parts failed: ${partsError.message}` });
    }
  }

  return NextResponse.json({ ok: true, product: newProduct });
}
