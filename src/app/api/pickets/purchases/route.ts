import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: adminProfile } = await supabase.from("profiles").select("role").eq("id", user?.id).single();

  if (adminProfile?.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { quantity, totalCostCents, purchasedAt } = await req.json();
  const qty = Math.round(Number(quantity));
  const totalCents = Math.round(Number(totalCostCents));

  if (!qty || qty <= 0) {
    return NextResponse.json({ error: "Quantity must be a positive number" }, { status: 400 });
  }
  if (!totalCents || totalCents <= 0) {
    return NextResponse.json({ error: "Total cost must be a positive number" }, { status: 400 });
  }

  const costPerPicketCents = Math.round(totalCents / qty);

  const { error } = await supabase.from("picket_purchases").insert({
    purchased_at: purchasedAt || new Date().toISOString().slice(0, 10),
    quantity: qty,
    total_cost_cents: totalCents,
    cost_per_picket_cents: costPerPicketCents,
    remaining_quantity: qty
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
