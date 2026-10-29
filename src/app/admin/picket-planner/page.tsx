import { createClient } from "@/lib/supabase/server";
import PicketPlanner from "@/components/PicketPlanner";
import type { BOMPart } from "@/lib/cutlistOptimizer";

// Start-of-year planning: given a number of pickets, how many of each product
// can be built, with the combined cut list. Read-only — it never changes
// inventory, orders or products; the only thing it can write is a saved cut
// list, and only when the Save button is pressed.
export default async function PicketPlannerPage() {
  const supabase = createClient();

  const [{ data: products }, { data: bomParts }, { data: purchases }] = await Promise.all([
    supabase.from("products").select("id, name").order("name", { ascending: true }),
    supabase.from("product_bom_parts").select("*"),
    supabase.from("picket_purchases").select("remaining_quantity")
  ]);

  const partsByProduct = new Map<string, BOMPart[]>();
  (bomParts || []).forEach((row: any) => {
    const list = partsByProduct.get(row.product_id) || [];
    list.push({
      partName: row.part_name,
      length: row.length_inches,
      finalLength: row.final_length_inches ?? undefined,
      quantityPerUnit: row.quantity_per_unit,
      materialType: row.material_type,
      isTrim: row.is_trim
    });
    partsByProduct.set(row.product_id, list);
  });

  // Only products that actually have a parts list can be planned.
  const plannable = (products || [])
    .filter((p: any) => partsByProduct.has(p.id))
    .map((p: any) => ({ id: p.id as string, name: p.name as string, parts: partsByProduct.get(p.id)! }));

  const picketsOnHand = (purchases || []).reduce((sum: number, p: any) => sum + (p.remaining_quantity || 0), 0);

  return <PicketPlanner products={plannable} picketsOnHand={picketsOnHand} />;
}
