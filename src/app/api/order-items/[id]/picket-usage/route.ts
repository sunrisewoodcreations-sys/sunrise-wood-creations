import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { consumePicketsFifo } from "@/lib/pickets";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: adminProfile } = await supabase.from("profiles").select("role").eq("id", user?.id).single();

  if (adminProfile?.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const admin = createAdminClient();

  const { data: item } = await admin
    .from("order_items")
    .select("id, order_id, product_type, pickets_used")
    .eq("id", params.id)
    .single();

  if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });
  if (item.product_type !== "planter") {
    return NextResponse.json({ error: "Picket usage only applies to planter box items" }, { status: 400 });
  }
  if (item.pickets_used != null) {
    return NextResponse.json({ error: "Pickets already logged for this item — can't log twice." }, { status: 400 });
  }

  const { picketsUsed } = await req.json();
  const qty = Math.round(Number(picketsUsed));
  if (!qty || qty <= 0) {
    return NextResponse.json({ error: "Enter how many pickets were used" }, { status: 400 });
  }

  const result = await consumePicketsFifo(admin, qty, item.order_id, item.id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  await admin.from("order_items").update({
    pickets_used: qty,
    material_cost_cents: result.totalCostCents
  }).eq("id", item.id);

  return NextResponse.json({ ok: true, materialCostCents: result.totalCostCents });
}
