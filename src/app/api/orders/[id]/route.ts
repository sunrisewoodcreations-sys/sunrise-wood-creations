import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: adminProfile } = await supabase.from("profiles").select("role").eq("id", user?.id).single();

  if (adminProfile?.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const admin = createAdminClient();

  // If this order used pickets, return them to the exact pallet(s) they
  // came from before deleting anything.
  const { data: allocations } = await admin
    .from("picket_usage_allocations")
    .select("purchase_id, quantity")
    .eq("order_id", params.id);

  for (const alloc of allocations || []) {
    const { data: purchase } = await admin
      .from("picket_purchases")
      .select("remaining_quantity")
      .eq("id", alloc.purchase_id)
      .maybeSingle();
    if (purchase) {
      await admin
        .from("picket_purchases")
        .update({ remaining_quantity: purchase.remaining_quantity + alloc.quantity })
        .eq("id", alloc.purchase_id);
    }
  }
  await admin.from("picket_usage_allocations").delete().eq("order_id", params.id);

  // Clean up everything that references this order first — several
  // tables built up over time may not all have automatic cascade-delete
  // configured, so we clear them explicitly rather than rely on that.
  await admin.from("proofs").delete().eq("order_id", params.id);
  await admin.from("order_items").delete().eq("order_id", params.id);
  await admin.from("order_messages").delete().eq("order_id", params.id);
  await admin.from("invoices").delete().eq("order_id", params.id);
  await admin.from("order_status_history").delete().eq("order_id", params.id);
  await admin.from("quote_requests").update({ converted_order_id: null }).eq("converted_order_id", params.id);

  const { error } = await admin.from("orders").delete().eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
