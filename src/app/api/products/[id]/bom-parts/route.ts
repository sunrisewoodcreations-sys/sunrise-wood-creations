import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Replaces a product's entire parts list in one go — matching how the
// tested prototype's edit form works (edit the whole BOM, save once),
// rather than separate add/edit/delete endpoints per part.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: adminProfile } = await supabase.from("profiles").select("role").eq("id", user?.id).single();

  if (adminProfile?.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { parts } = await req.json();
  if (!Array.isArray(parts)) {
    return NextResponse.json({ error: "Expected a list of parts" }, { status: 400 });
  }

  for (const part of parts) {
    if (!part.partName?.trim() || !part.length || Number(part.length) <= 0) {
      return NextResponse.json({ error: "Every part needs a name and a length greater than 0" }, { status: 400 });
    }
  }

  const { error: deleteError } = await supabase.from("product_bom_parts").delete().eq("product_id", params.id);
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 400 });
  }

  if (parts.length > 0) {
    const rows = parts.map((p: any, i: number) => ({
      product_id: params.id,
      part_name: p.partName.trim(),
      length_inches: Number(p.length),
      final_length_inches: p.finalLength ? Number(p.finalLength) : null,
      quantity_per_unit: Math.max(1, Math.round(Number(p.quantityPerUnit) || 1)),
      material_type: p.materialType?.trim() || "Cedar",
      is_trim: !!p.isTrim,
      grain_direction: p.grainDirection || null,
      sort_order: i
    }));

    const { error: insertError } = await supabase.from("product_bom_parts").insert(rows);
    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 400 });
    }
  }

  return NextResponse.json({ ok: true });
}
