import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { reschedulePickupAppointment, cancelPickupAppointment, sendPickupConfirmation } from "@/lib/pickupScheduling";

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
  const { action, dateStr, time, notes } = await req.json();

  if (action === "reschedule") {
    if (!dateStr || !time) return NextResponse.json({ error: "Pick a date and time." }, { status: 400 });
    const result = await reschedulePickupAppointment({ appointmentId: params.id, dateStr, time, rescheduledBy: "admin" });
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
    const { error } = await admin.from("pickup_appointments").update({ status: "completed" }).eq("id", params.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
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

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
