import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// One route toggles both the per-product build-step checklist and the
// material checklist — same shape (order + item id, checked or not),
// just pointed at a different table, so this doesn't need two
// near-identical routes for what's functionally the same action.
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: adminProfile } = await supabase.from("profiles").select("role").eq("id", user?.id).single();
  if (adminProfile?.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { orderId, itemId, kind, checked } = await req.json();
  if (!orderId || !itemId || !["step", "material"].includes(kind)) {
    return NextResponse.json({ error: "Missing orderId, itemId, or kind" }, { status: 400 });
  }

  const admin = createAdminClient();
  const table = kind === "step" ? "order_checklist_progress" : "order_material_checklist_progress";
  const itemCol = kind === "step" ? "checklist_item_id" : "bom_part_id";

  if (checked) {
    const { error } = await admin.from(table).insert({ order_id: orderId, [itemCol]: itemId });
    // A unique-constraint violation just means it's already checked — not a real error.
    if (error && error.code !== "23505") return NextResponse.json({ error: error.message }, { status: 400 });
  } else {
    const { error } = await admin.from(table).delete().eq("order_id", orderId).eq(itemCol, itemId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
