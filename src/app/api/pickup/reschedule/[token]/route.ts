import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { reschedulePickupAppointment, sendPickupConfirmation } from "@/lib/pickupScheduling";

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const admin = createAdminClient();

  const { data: appointment } = await admin
    .from("pickup_appointments")
    .select("id, status")
    .eq("reschedule_token", params.token)
    .maybeSingle();

  if (!appointment) return NextResponse.json({ error: "This reschedule link is invalid." }, { status: 404 });
  if (!["scheduled"].includes(appointment.status)) {
    return NextResponse.json({ error: "This appointment can no longer be rescheduled. Please contact us directly." }, { status: 400 });
  }

  const { dateStr, time } = await req.json();
  if (!dateStr || !time) return NextResponse.json({ error: "Pick a date and time." }, { status: 400 });

  const result = await reschedulePickupAppointment({ appointmentId: appointment.id, dateStr, time, rescheduledBy: "customer" });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || `https://${req.headers.get("host")}`;
  await sendPickupConfirmation(appointment.id, siteUrl, true); // best-effort — reschedule itself already succeeded

  return NextResponse.json({ ok: true });
}
