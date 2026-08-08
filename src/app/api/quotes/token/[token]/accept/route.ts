import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildOrderItemsFromQuote } from "@/lib/quote";
import { createOrder } from "@/lib/orders";

// Public on purpose — no login required, same principle as the
// existing proof-response token routes. The token itself (a random,
// unguessable value already on the quotes table) is the authorization,
// not a session. Reuses the exact same createOrder() function every
// other order-creation path uses.
export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const admin = createAdminClient();

  const { data: quote } = await admin.from("quotes").select("*").eq("share_token", params.token).maybeSingle();
  if (!quote) return NextResponse.json({ error: "This quote link is invalid." }, { status: 404 });

  if (["accepted", "declined"].includes(quote.status)) {
    return NextResponse.json({ error: `This quote has already been ${quote.status}.` }, { status: 400 });
  }
  const isExpired = new Date(quote.expiration_date + "T23:59:59Z") < new Date();
  if (isExpired) {
    return NextResponse.json({ error: "This quote has expired and can no longer be accepted." }, { status: 400 });
  }

  const orderItems = await buildOrderItemsFromQuote(admin, quote.id);
  if (!orderItems) return NextResponse.json({ error: "This quote has no items to convert." }, { status: 400 });

  const result = await createOrder({ customerId: quote.customer_id, items: orderItems, isDemo: !!quote.is_demo });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  await admin.from("quotes").update({ status: "accepted", converted_order_id: result.order.id }).eq("id", quote.id);
  await admin.from("orders").update({ quote_id: quote.id }).eq("id", result.order.id);

  return NextResponse.json({ ok: true, orderId: result.order.id });
}
