import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { bookPickupAppointment, sendPickupConfirmation } from "@/lib/pickupScheduling";

// Public on purpose — no login required, same principle as every other
// token-based customer action in this app (proofs, quote acceptance).
export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const admin = createAdminClient();

  const { data: order } = await admin
    .from("orders")
    .select("id, pickup_scheduling_token_used_at")
    .eq("pickup_scheduling_token", params.token)
    .maybeSingle();

  if (!order) return NextResponse.json({ error: "This scheduling link is invalid." }, { status: 404 });
  if (order.pickup_scheduling_token_used_at) {
    return NextResponse.json({ error: "This link has already been used. Contact us if you need to make a change." }, { status: 400 });
  }

  const { dateStr, time } = await req.json();
  if (!dateStr || !time) return NextResponse.json({ error: "Pick a date and time." }, { status: 400 });

  const result = await bookPickupAppointment({ orderId: order.id, dateStr, time, source: "customer_token_link" });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  await admin.from("orders").update({ pickup_scheduling_token_used_at: new Date().toISOString() }).eq("id", order.id);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || `https://${req.headers.get("host")}`;
  await sendPickupConfirmation(result.appointmentId, siteUrl, false); // best-effort — booking itself already succeeded

  return NextResponse.json({ ok: true });
}
