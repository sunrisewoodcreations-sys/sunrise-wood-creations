import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPickupSchedulingEmail } from "@/lib/email";
import { sendPickupConfirmation } from "@/lib/pickupScheduling";

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

  const { mode, dateStr, time } = await req.json();
  const admin = createAdminClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || `https://${req.headers.get("host")}`;

  const { data: order } = await admin.from("orders").select("id, title, fulfillment_method").eq("id", params.id).maybeSingle();
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (order.fulfillment_method !== "pickup") {
    return NextResponse.json({ error: "This order isn't marked for pickup." }, { status: 400 });
  }

  if (mode === "send_email") {
    const { data: customer } = await admin.from("orders").select("profiles:customer_id(full_name, email)").eq("id", params.id).single();
    const email = (customer as any)?.profiles?.email;
    const name = (customer as any)?.profiles?.full_name;
    if (!email) return NextResponse.json({ error: "This customer has no email on file." }, { status: 400 });

    const token = crypto.randomBytes(24).toString("hex");
    const { error: tokenError } = await admin.from("orders").update({
      pickup_scheduling_token: token,
      pickup_scheduling_email_sent_at: new Date().toISOString()
    }).eq("id", params.id);
    if (tokenError) return NextResponse.json({ error: tokenError.message }, { status: 400 });

    try {
      await sendPickupSchedulingEmail({
        toEmail: email,
        customerName: name,
        orderTitle: order.title,
        schedulingUrl: `${siteUrl}/pickup/schedule/${token}`
      });
    } catch (err: any) {
      return NextResponse.json({ error: err.message || "Couldn't send the scheduling email." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  }

  if (mode === "already_scheduled") {
    if (!dateStr || !time) return NextResponse.json({ error: "Pick a date and time." }, { status: 400 });

    const { data: appointment, error } = await admin
      .from("pickup_appointments")
      .insert({ order_id: params.id, appointment_date: dateStr, appointment_time: time, source: "admin_manual" })
      .select()
      .single();
    if (error || !appointment) return NextResponse.json({ error: error?.message || "Couldn't create the appointment." }, { status: 400 });

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
