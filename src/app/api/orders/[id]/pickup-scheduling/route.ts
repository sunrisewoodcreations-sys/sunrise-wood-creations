import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPickupConfirmation, triggerPickupSchedulingEmail, bookPickupAppointment } from "@/lib/pickupScheduling";
import { resolveAndStoreDeliveryAddress } from "@/lib/deliveryAddress";

// Handles both admin paths from the "Ready for Pickup" dual choice:
// mode "send_email" generates a token and emails the customer a
// scheduling link; mode "already_scheduled" creates the appointment
// directly from admin-entered date/time, no email needed for the link
// itself (though it does send the same confirmation email a customer
// booking would get, since they should still know when to show up).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: adminProfile } = await supabase.from("profiles").select("role").eq("id", user?.id).single();
  if (adminProfile?.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { mode, dateStr, time, address, confirmAddress } = await req.json();
  const admin = createAdminClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || `https://${req.headers.get("host")}`;

  const { data: order } = await admin.from("orders").select("id, title, fulfillment_method").eq("id", params.id).maybeSingle();
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (order.fulfillment_method !== "pickup" && order.fulfillment_method !== "delivery") {
    return NextResponse.json({ error: "This order isn't marked for pickup or delivery." }, { status: 400 });
  }

  if (mode === "send_email") {
    const result = await triggerPickupSchedulingEmail(params.id, siteUrl);
    if (!result.sent) return NextResponse.json({ error: result.error || "Couldn't send the scheduling email." }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  if (mode === "already_scheduled") {
    if (!dateStr || !time) return NextResponse.json({ error: "Pick a date and time." }, { status: 400 });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return NextResponse.json({ error: "That date or time isn't valid." }, { status: 400 });

    // Delivery: the address (and so the drive time) must be on the order
    // first. Pass `address` here to enter it for the customer.
    if (order.fulfillment_method === "delivery" && typeof address === "string" && address.trim()) {
      const resolved = await resolveAndStoreDeliveryAddress(params.id, address, confirmAddress === true);
      if (!resolved.ok) {
        if (resolved.needsConfirmation) return NextResponse.json({ needsConfirmation: true, suggestedAddress: resolved.suggestedAddress, reason: resolved.reason });
        return NextResponse.json({ error: resolved.error }, { status: resolved.status });
      }
    }

    const booked = await bookPickupAppointment({ orderId: params.id, dateStr, time, source: "admin_manual", skipAvailabilityCheck: true });
    if (!booked.ok) return NextResponse.json({ error: booked.error }, { status: 400 });
    const appointment = { id: booked.appointmentId };

    const confirmResult = await sendPickupConfirmation(appointment.id, siteUrl, false);
    if (!confirmResult.ok) {
      // The appointment itself is saved either way — a failed email
      // shouldn't undo that. Just let the admin know to follow up.
      return NextResponse.json({ ok: true, emailWarning: confirmResult.error });
    }

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown mode" }, { status: 400 });
}
