import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Converts a quote into a real order by calling the EXISTING order
// creation endpoint directly (a real server-side request to /api/orders,
// forwarding the admin's own session cookie) rather than reimplementing
// order creation here. Whatever /api/orders does today — stock checks,
// auto-ready-for-pickup, confirmation emails, picket consumption — this
// quote-created order gets exactly the same treatment, automatically,
// with no second copy of that logic to keep in sync.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: adminProfile } = await supabase.from("profiles").select("role").eq("id", user?.id).single();
  if (adminProfile?.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: quote } = await admin.from("quotes").select("*").eq("id", params.id).maybeSingle();
  if (!quote) return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  if (quote.converted_order_id) return NextResponse.json({ error: "This quote has already been converted to an order" }, { status: 400 });

  const { data: items } = await admin.from("quote_items").select("*").eq("quote_id", params.id).order("sort_order", { ascending: true });
  if (!items || items.length === 0) return NextResponse.json({ error: "This quote has no line items to convert" }, { status: 400 });

  // Every quote line item needs a real product to link to for the order
  // form's product-type requirement — items without one fall back to
  // "sign" as a generic catch-all product type, matching how a custom,
  // unlinked line item would otherwise have no type at all.
  const productIds = items.map((it: any) => it.product_id).filter(Boolean);
  const { data: products } = productIds.length > 0
    ? await admin.from("products").select("id, product_type").in("id", productIds)
    : { data: [] as any[] };
  const productTypeById = new Map((products || []).map((p: any) => [p.id, p.product_type]));

  const orderItems = items.map((it: any) => ({
    productType: it.product_id ? (productTypeById.get(it.product_id) || "sign") : "sign",
    productId: it.product_id,
    title: it.title,
    quantity: it.quantity,
    priceCents: it.unit_price_cents * it.quantity // order items store the line TOTAL, not unit price
  }));

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || `https://${req.headers.get("host")}`;
  const orderRes = await fetch(new URL("/api/orders", siteUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: req.headers.get("cookie") || ""
    },
    body: JSON.stringify({
      customerId: quote.customer_id,
      items: orderItems
      // Deliberately no dueDate — /api/orders already auto-assigns a
      // sensible production/pickup date when none is given.
    })
  });

  const orderBody = await orderRes.json().catch(() => ({}));
  if (!orderRes.ok) {
    return NextResponse.json({ error: orderBody.error || "Couldn't create the order from this quote" }, { status: 400 });
  }

  await admin.from("quotes").update({ status: "accepted", converted_order_id: orderBody.order.id }).eq("id", params.id);
  await admin.from("orders").update({ quote_id: params.id }).eq("id", orderBody.order.id);

  return NextResponse.json({ ok: true, order: orderBody.order });
}
