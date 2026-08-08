import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildOrderItemsFromQuote } from "@/lib/quote";
import { createOrder } from "@/lib/orders";

// Converts a quote into a real order by calling the exact same shared
// createOrder() function the order-creation endpoint itself uses —
// whatever that function does (stock checks, auto-ready-for-pickup,
// confirmation emails, picket consumption) happens automatically here
// too, with no second copy of any of it.
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

  const orderItems = await buildOrderItemsFromQuote(admin, params.id);
  if (!orderItems) return NextResponse.json({ error: "This quote has no line items to convert" }, { status: 400 });

  const result = await createOrder({ customerId: quote.customer_id, items: orderItems });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  await admin.from("quotes").update({ status: "accepted", converted_order_id: result.order.id }).eq("id", params.id);
  await admin.from("orders").update({ quote_id: params.id }).eq("id", result.order.id);

  return NextResponse.json({ ok: true, order: result.order });
}
