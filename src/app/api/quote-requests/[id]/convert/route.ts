import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const PRODUCT_TYPE_MAP: Record<string, string> = {
  cornhole: "cornhole",
  sign: "sign",
  planter: "planter",
  cutting_board: "cutting_board"
};

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: adminProfile } = await supabase.from("profiles").select("role").eq("id", user?.id).single();

  if (adminProfile?.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { data: quote } = await supabase.from("quote_requests").select("*").eq("id", params.id).single();
  if (!quote) return NextResponse.json({ error: "Quote request not found" }, { status: 404 });

  const admin = createAdminClient();

  // Reuse or create the customer, matched by email.
  const { data: existing } = await admin.auth.admin.listUsers();
  let customerId = existing?.users.find(u => u.email?.toLowerCase() === quote.email.toLowerCase())?.id;

  if (!customerId) {
    const { error: gateError } = await admin
      .from("allowed_emails")
      .upsert({ email: quote.email.toLowerCase(), full_name: quote.name });
    if (gateError) {
      return NextResponse.json({ error: gateError.message }, { status: 400 });
    }

    const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(quote.email.toLowerCase(), {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/update-password`
    });
    if (inviteError) {
      return NextResponse.json({ error: inviteError.message }, { status: 400 });
    }

    const { data: refreshed } = await admin.auth.admin.listUsers();
    customerId = refreshed?.users.find(u => u.email?.toLowerCase() === quote.email.toLowerCase())?.id;
    if (customerId) {
      await admin.from("profiles").update({ has_real_email: true }).eq("id", customerId);
    }
  }

  if (!customerId) {
    return NextResponse.json({ error: "Couldn't find or create a customer for this quote" }, { status: 400 });
  }

  const { priceCents, productType: productTypeOverride } = await req.json().catch(() => ({}));

  const productType = PRODUCT_TYPE_MAP[productTypeOverride || quote.product_type || ""] || "sign";
  const title = (quote.description || "Custom order").slice(0, 80);
  const sizeDetails = [quote.dimensions, quote.wood_type].filter(Boolean).join(" · ") || null;

  const { data: order, error: orderError } = await admin
    .from("orders")
    .insert({
      customer_id: customerId,
      product_type: productType,
      title,
      size_details: sizeDetails,
      price_cents: Math.round(Number(priceCents)) || 0,
      quantity: 1,
      status: "order_placed"
    })
    .select()
    .single();

  if (orderError || !order) {
    return NextResponse.json({ error: orderError?.message || "Couldn't create the order" }, { status: 400 });
  }

  await admin.from("order_items").insert({
    order_id: order.id,
    product_type: productType,
    title,
    size_details: sizeDetails,
    quantity: 1,
    unit_price_cents: Math.round(Number(priceCents)) || 0
  });

  await admin.from("quote_requests").update({ responded: true, converted_order_id: order.id }).eq("id", quote.id);

  return NextResponse.json({ ok: true, orderId: order.id });
}
