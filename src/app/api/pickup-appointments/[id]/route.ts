import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { addStopOnWayHome } from "@/lib/deliveryChain";
import { sendDeliveryOnTheWayEmail } from "@/lib/email";
import { easternNow, absMinute } from "@/lib/scheduleCore";
import { sendReviewRequestForOrder } from "@/lib/reviewRequest";
import { shouldNotify } from "@/lib/notify";
import { issueInvoiceForOrder } from "@/lib/invoice";
import { getAvailabilitySettings, reschedulePickupAppointment, cancelPickupAppointment, sendPickupConfirmation } from "@/lib/pickupScheduling";

// Admin-side appointment management — reuses the exact same
// reschedule/cancel functions the customer-facing token routes
// already use, just with admin-session authorization instead of a
// token, and an admin-specific "mark_arrived" / "mark_missed" action
// for closing out an appointment on the day of pickup.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: adminProfile } = await supabase.from("profiles").select("role").eq("id", user?.id).single();
  if (adminProfile?.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { action, dateStr, time, notes, secondOrderId, secondAddress, confirmAddress, override } = await req.json();

  if (action === "reschedule") {
    if (!dateStr || !time) return NextResponse.json({ error: "Pick a date and time." }, { status: 400 });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return NextResponse.json({ error: "That date or time isn't valid." }, { status: 400 });
    const result = await reschedulePickupAppointment({ appointmentId: params.id, dateStr, time, rescheduledBy: "admin", override: override === true });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || `https://${req.headers.get("host")}`;
    const confirmResult = await sendPickupConfirmation(params.id, siteUrl, true);
    return NextResponse.json({ ok: true, emailWarning: confirmResult.ok ? undefined : confirmResult.error });
  }

  if (action === "cancel") {
    const result = await cancelPickupAppointment(params.id);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  if (action === "mark_arrived") {
    const { error } = await admin.from("pickup_appointments").update({ status: "arrived" }).eq("id", params.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  if (action === "mark_completed") {
    const { data: appt } = await admin.from("pickup_appointments").select("appointment_type, order_id").eq("id", params.id).maybeSingle();
    const { error } = await admin.from("pickup_appointments").update({ status: "completed" }).eq("id", params.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    // Marking a pickup or delivery done finishes the order the same way
    // "Picked up" does on the order page: paid in full, status updated,
    // final invoice and the rate-your-order email sent.
    if (appt?.order_id) {
      const { data: order } = await admin
        .from("orders")
        .select("*, profiles:customer_id(email, full_name, has_real_email, notify_invoices, notify_order_updates)")
        .eq("id", appt.order_id)
        .maybeSingle();
      if (order && order.status !== "picked_up") {
        await admin.from("orders").update({ status: "picked_up", amount_paid_cents: Math.max(order.amount_paid_cents || 0, order.price_cents || 0) }).eq("id", order.id);
        order.amount_paid_cents = Math.max(order.amount_paid_cents || 0, order.price_cents || 0);
        try {
          await issueInvoiceForOrder(order, (order as any).profiles);
        } catch (err) {
          console.error("Invoice generation failed:", err);
        }
        await sendReviewRequestForOrder(order.id, process.env.NEXT_PUBLIC_SITE_URL || `https://${req.headers.get("host")}`);
      }
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "update_notes") {
    const { error } = await admin.from("pickup_appointments").update({ internal_notes: notes }).eq("id", params.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  if (action === "mark_missed") {
    const { error } = await admin.from("pickup_appointments").update({ status: "missed" }).eq("id", params.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  // Deliveries only: tap when you leave. The customer sees "on our way"
  // (status only, no location) on their appointment page.
  if (action === "on_my_way" || action === "clear_on_my_way" || action === "maps_opened") {
    const { data: appt } = await admin.from("pickup_appointments").select("appointment_type, status, on_my_way_at, appointment_time, appointment_date, block_start_at, order_id").eq("id", params.id).maybeSingle();
    if (!appt) return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
    if (appt.appointment_type !== "delivery") return NextResponse.json({ error: "\"On my way\" is only for deliveries." }, { status: 400 });
    if (appt.status !== "scheduled") return NextResponse.json({ error: "This delivery isn't active." }, { status: 400 });
    // Opening Google/Apple Maps counts as "I'm leaving" only when it is
    // around leave time: from 5 minutes before the leave-by time until
    // 30 minutes after the arrival time. Earlier than that is just looking.
    if (action === "maps_opened") {
      if (appt.on_my_way_at) return NextResponse.json({ ok: true, skipped: "already_sent" });
      const leaveAbs = appt.block_start_at
        ? absMinute(String(appt.block_start_at).slice(0, 10), String(appt.block_start_at).slice(11, 16))
        : absMinute(appt.appointment_date, String(appt.appointment_time).slice(0, 5));
      const arriveAbs = absMinute(appt.appointment_date, String(appt.appointment_time).slice(0, 5));
      const nowAbs = easternNow().abs;
      if (nowAbs < leaveAbs - 5 || nowAbs > arriveAbs + 30) return NextResponse.json({ ok: true, skipped: "outside_window" });
    }
    const { error } = await admin.from("pickup_appointments")
      .update({ on_my_way_at: action === "clear_on_my_way" ? null : new Date().toISOString() }).eq("id", params.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    // Email the customer once when "On my way" is first tapped.
    let emailWarning: string | undefined;
    if (action !== "clear_on_my_way" && !appt.on_my_way_at) {
      try {
        const { data: order } = await admin
          .from("orders")
          .select("id, title, is_demo, delivery_address, pickup_scheduling_token, profiles:customer_id(email, full_name, has_real_email, notify_order_updates)")
          .eq("id", appt.order_id)
          .maybeSingle();
        const customer = (order as any)?.profiles;
        if (customer?.email && shouldNotify(customer, "order_updates")) {
          const settings = await getAvailabilitySettings();
          const [h, m] = String(appt.appointment_time).split(":").map(Number);
          const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || `https://${req.headers.get("host")}`;
          await sendDeliveryOnTheWayEmail({
            toEmail: customer.email,
            customerName: customer.full_name,
            orderTitle: order!.title,
            appointmentTimeDisplay: `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`,
            deliveryAddress: order!.delivery_address || undefined,
            contactPhone: settings.contact_phone,
            viewUrl: `${siteUrl}/account/orders/${order!.id}`,
            forceDemo: typeof order!.is_demo === "boolean" ? order!.is_demo : true
          });
        }
      } catch (err: any) {
        console.error("On-my-way email failed:", err);
        emailWarning = err?.message || "Couldn't send the on-my-way email";
      }
    }
    return NextResponse.json({ ok: true, emailWarning });
  }

  // "I'm dropping another one on my way home."
  if (action === "add_stop_home") {
    if (!secondOrderId) return NextResponse.json({ error: "Pick the second order." }, { status: 400 });
    const result = await addStopOnWayHome({ firstAppointmentId: params.id, secondOrderId, secondAddress, confirmAddress: confirmAddress === true });
    if (!result.ok) {
      if (result.needsConfirmation) return NextResponse.json({ needsConfirmation: true, suggestedAddress: result.suggestedAddress, reason: result.reason });
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || `https://${req.headers.get("host")}`;
    const confirmResult = await sendPickupConfirmation(result.appointmentId, siteUrl, false);
    return NextResponse.json({ ok: true, arrivalDate: result.arrivalDate, arrivalTime: result.arrivalTime, emailWarning: confirmResult.ok ? undefined : confirmResult.error });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
