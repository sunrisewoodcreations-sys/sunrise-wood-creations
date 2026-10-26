import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveAndStoreDeliveryAddress } from "@/lib/deliveryAddress";

// Public on purpose (the scheduling token is the authorization, same as
// the booking route). Saves the customer's delivery address and works out
// the drive time, so the next page can show only times that really fit.
export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("id, fulfillment_method, pickup_scheduling_token_used_at")
    .eq("pickup_scheduling_token", params.token)
    .maybeSingle();

  if (!order) return NextResponse.json({ error: "This scheduling link is invalid." }, { status: 404 });
  if (order.fulfillment_method !== "delivery") return NextResponse.json({ error: "This order isn't set up for delivery." }, { status: 400 });
  if (order.pickup_scheduling_token_used_at) return NextResponse.json({ error: "This link has already been used." }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const result = await resolveAndStoreDeliveryAddress(order.id, typeof body.address === "string" ? body.address : "", body.confirmAddress === true);
  if (!result.ok) {
    if (result.needsConfirmation) {
      return NextResponse.json({ needsConfirmation: true, suggestedAddress: result.suggestedAddress, reason: result.reason });
    }
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true, address: result.address });
}
