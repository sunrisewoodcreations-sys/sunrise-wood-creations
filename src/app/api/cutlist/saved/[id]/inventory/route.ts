import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { markOldestWaitingOrderReady } from "@/lib/inventoryFulfillment";

type Item = { productId: string; name: string; quantity: number; added?: number };

// POST { action: "add", productId }
//   Adds ONE unit of a product to stock (logged in product_stock_adjustments),
//   marks that line done, then marks the oldest waiting order for that product
//   Ready and emails the customer through the existing status route.
// POST { action: "dismiss" } → removes the whole plan from the Home Screen, no stock change.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: adminProfile } = await supabase.from("profiles").select("role").eq("id", user?.id).single();
  if (adminProfile?.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { data: list } = await supabase
    .from("saved_cut_lists").select("id, name, result_json").eq("id", params.id).maybeSingle();
  if (!list) return NextResponse.json({ error: "Saved list not found" }, { status: 404 });
  const inv = list.result_json?.inventory;
  if (inv?.status !== "pending" || !Array.isArray(inv.items)) {
    return NextResponse.json({ error: "This one was already handled." }, { status: 409 });
  }

  if (body.action === "dismiss") {
    const { error } = await supabase.from("saved_cut_lists")
      .update({ result_json: { ...list.result_json, inventory: { ...inv, status: "dismissed" } } }).eq("id", list.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  const productId = String(body.productId || "");
  const quantity = 1; // always one unit at a time (each piece finishes separately)
  const items: Item[] = inv.items;
  const idx = items.findIndex(i => i.productId === productId);
  if (idx < 0) return NextResponse.json({ error: "That product isn't part of this plan." }, { status: 400 });
  if ((items[idx].added ?? 0) >= items[idx].quantity) {
    return NextResponse.json({ error: "All of those were already added." }, { status: 409 });
  }

  // Claim this line first so a double-tap can't add twice.
  const newItems = items.map((i, n) => n === idx ? { ...i, added: (i.added ?? 0) + 1 } : i);
  const allDone = newItems.every(i => (i.added ?? 0) >= i.quantity);
  const claimed = { ...list.result_json, inventory: { ...inv, items: newItems, status: allDone ? "added" : "pending", ...(allDone ? { addedAt: new Date().toISOString() } : {}) } };
  const { data: claimRows, error: claimErr } = await supabase
    .from("saved_cut_lists").update({ result_json: claimed }).eq("id", list.id)
    .eq("result_json->inventory->>status", "pending").select("id");
  if (claimErr || !claimRows || claimRows.length === 0) {
    return NextResponse.json({ error: "This one was already handled." }, { status: 409 });
  }

  const { data: product } = await supabase
    .from("products").select("stock_quantity, low_stock_threshold").eq("id", productId).maybeSingle();
  const undo = () => supabase.from("saved_cut_lists").update({ result_json: list.result_json }).eq("id", list.id);
  if (!product) { await undo(); return NextResponse.json({ error: "Product not found." }, { status: 404 }); }

  const oldQty = product.stock_quantity ?? 0;
  const newQty = oldQty + quantity;
  const patch: any = { stock_quantity: newQty };
  if (newQty > (product.low_stock_threshold ?? 0)) patch.low_stock_alert_sent = false;
  const { error: upErr } = await supabase.from("products").update(patch).eq("id", productId);
  if (upErr) { await undo(); return NextResponse.json({ error: upErr.message }, { status: 400 }); }
  await supabase.from("product_stock_adjustments").insert({
    product_id: productId, old_quantity: oldQty, new_quantity: newQty,
    reason: `Built from saved plan: ${list.name}`
  });

  // Oldest waiting order for this product → Ready, and email the customer.
  let notified: { title: string; customerName: string | null; emailed: boolean } | null = null;
  try {
    const order = await markOldestWaitingOrderReady(createAdminClient(), productId);
    if (order) {
      let emailed = false;
      try {
        // Same route the order page uses: sends the "ready for pickup/delivery"
        // email with invoice + scheduling link. Forward the admin's session.
        const r = await fetch(`${req.nextUrl.origin}/api/orders/${order.id}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", cookie: req.headers.get("cookie") || "" },
          body: JSON.stringify({ status: "ready_for_pickup" })
        });
        emailed = r.ok;
      } catch (err) {
        console.error("Ready email trigger failed:", err);
      }
      notified = { title: order.title, customerName: order.customerName, emailed };
    }
  } catch (err) {
    console.error("Oldest-order fulfillment failed:", err);
  }

  return NextResponse.json({ ok: true, notified });
}
