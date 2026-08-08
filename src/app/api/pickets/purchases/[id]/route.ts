import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: adminProfile } = await supabase.from("profiles").select("role").eq("id", user?.id).single();

  if (adminProfile?.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { purchasedAt, quantity, totalCostCents } = await req.json();
  const newQuantity = Math.round(Number(quantity));
  const newTotalCostCents = Math.round(Number(totalCostCents));

  if (!purchasedAt || !newQuantity || newQuantity <= 0 || !newTotalCostCents || newTotalCostCents <= 0) {
    return NextResponse.json({ error: "Enter a valid date, quantity, and total cost" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("picket_purchases")
    .select("quantity, remaining_quantity")
    .eq("id", params.id)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "Purchase not found" }, { status: 404 });
  }

  // Preserve how many have already been used from this pallet — shift
  // remaining_quantity by the same amount the total quantity changed by,
  // rather than resetting it, so correcting a typo doesn't wipe out
  // real FIFO usage history already recorded against this purchase.
  const alreadyUsed = existing.quantity - existing.remaining_quantity;
  const newRemaining = newQuantity - alreadyUsed;

  if (newRemaining < 0) {
    return NextResponse.json({
      error: `Can't set quantity below ${alreadyUsed} — that many pickets from this pallet have already been used on orders.`
    }, { status: 400 });
  }

  const { error } = await admin
    .from("picket_purchases")
    .update({
      purchased_at: purchasedAt,
      quantity: newQuantity,
      total_cost_cents: newTotalCostCents,
      cost_per_picket_cents: Math.round(newTotalCostCents / newQuantity),
      remaining_quantity: newRemaining
    })
    .eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: adminProfile } = await supabase.from("profiles").select("role").eq("id", user?.id).single();

  if (adminProfile?.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("picket_purchases")
    .select("quantity, remaining_quantity")
    .eq("id", params.id)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "Purchase not found" }, { status: 404 });
  }

  // Only allow deleting a pallet that hasn't had anything used from it
  // yet — deleting one that's already been drawn from would corrupt the
  // cost history of whatever orders used it.
  if (existing.remaining_quantity !== existing.quantity) {
    return NextResponse.json({
      error: "Can't delete this — pickets from this pallet have already been used on an order. Edit it instead."
    }, { status: 400 });
  }

  const { error } = await admin.from("picket_purchases").delete().eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
