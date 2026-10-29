import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST { action: "add", items: [{ productId, quantity }] }  → raises each
//   product's stock by that quantity, logs it in product_stock_adjustments,
//   and marks the saved plan as added so it leaves the Home Screen.
// POST { action: "dismiss" } → marks it as not needed, no stock change.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: adminProfile } = await supabase.from("profiles").select("role").eq("id", user?.id).single();
  if (adminProfile?.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const action = body.action === "dismiss" ? "dismiss" : "add";

  const { data: list } = await supabase
    .from("saved_cut_lists").select("id, name, result_json").eq("id", params.id).maybeSingle();
  if (!list) return NextResponse.json({ error: "Saved list not found" }, { status: 404 });
  if (list.result_json?.inventory?.status !== "pending") {
    return NextResponse.json({ error: "This one was already handled." }, { status: 409 });
  }

  const added: { productId: string; quantity: number }[] = [];
  if (action === "add") {
    const items = Array.isArray(body.items) ? body.items : [];
    const wanted = items
      .map((i: any) => ({ productId: String(i.productId || ""), quantity: Math.floor(Number(i.quantity)) }))
      .filter((i: any) => i.productId && i.quantity > 0 && i.quantity <= 100000);
    if (wanted.length === 0) {
      return NextResponse.json({ error: "Nothing to add. Enter a quantity of 1 or more." }, { status: 400 });
    }

    // Only products that were actually part of this saved plan.
    const allowed = new Set((list.result_json.inventory.items as any[]).map(i => i.productId));
    if (wanted.some((w: any) => !allowed.has(w.productId))) {
      return NextResponse.json({ error: "That product isn't part of this plan." }, { status: 400 });
    }

    // Mark added first so a double-tap can't add twice; undo if stock fails.
    const marked = { ...list.result_json, inventory: { ...list.result_json.inventory, status: "added", addedAt: new Date().toISOString(), added: wanted } };
    const { data: claimed, error: claimErr } = await supabase
      .from("saved_cut_lists").update({ result_json: marked }).eq("id", list.id)
      .eq("result_json->inventory->>status", "pending").select("id");
    if (claimErr || !claimed || claimed.length === 0) {
      return NextResponse.json({ error: "This one was already handled." }, { status: 409 });
    }

    for (const w of wanted) {
      const { data: product } = await supabase
        .from("products").select("stock_quantity, low_stock_threshold").eq("id", w.productId).maybeSingle();
      if (!product) continue;
      const oldQty = product.stock_quantity ?? 0;
      const newQty = oldQty + w.quantity;
      const patch: any = { stock_quantity: newQty };
      if (newQty > (product.low_stock_threshold ?? 0)) patch.low_stock_alert_sent = false;
      const { error: upErr } = await supabase.from("products").update(patch).eq("id", w.productId);
      if (upErr) {
        // Roll back what we can so the plan stays pending and nothing is double counted.
        for (const done of added) {
          const { data: p } = await supabase.from("products").select("stock_quantity").eq("id", done.productId).maybeSingle();
          if (p) await supabase.from("products").update({ stock_quantity: Math.max(0, (p.stock_quantity ?? 0) - done.quantity) }).eq("id", done.productId);
        }
        await supabase.from("saved_cut_lists").update({ result_json: list.result_json }).eq("id", list.id);
        return NextResponse.json({ error: upErr.message }, { status: 400 });
      }
      await supabase.from("product_stock_adjustments").insert({
        product_id: w.productId, old_quantity: oldQty, new_quantity: newQty,
        reason: `Built from saved plan: ${list.name}`
      });
      added.push(w);
    }
    return NextResponse.json({ ok: true, added });
  }

  const marked = { ...list.result_json, inventory: { ...list.result_json.inventory, status: "dismissed" } };
  const { error } = await supabase.from("saved_cut_lists").update({ result_json: marked }).eq("id", list.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
