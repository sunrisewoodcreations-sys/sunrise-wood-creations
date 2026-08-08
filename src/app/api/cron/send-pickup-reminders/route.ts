import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAvailabilitySettings } from "@/lib/pickupScheduling";
import { sendPickupReminderEmail } from "@/lib/email";

// Called automatically by Vercel Cron (see vercel.json), same
// CRON_SECRET protection as the existing financial report job — not a
// new auth pattern. Runs hourly, checking for any scheduled
// appointment landing in roughly 24 hours (always) or roughly 2 hours
// (only if enabled in Pickup Settings) that hasn't already gotten that
// specific reminder — reminder_24h_sent_at / reminder_2h_sent_at exist
// specifically to make this check idempotent no matter how often the
// job runs.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const settings = await getAvailabilitySettings();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://sunrisewoodcreations.com";

  const now = new Date();
  let sent24h = 0;
  let sent2h = 0;

  async function sendRemindersFor(hoursUntil: 24 | 2, columnName: "reminder_24h_sent_at" | "reminder_2h_sent_at") {
    const windowStart = new Date(now.getTime() + (hoursUntil - 0.5) * 60 * 60 * 1000);
    const windowEnd = new Date(now.getTime() + (hoursUntil + 0.5) * 60 * 60 * 1000);

    const { data: candidates } = await admin
      .from("pickup_appointments")
      .select("id, appointment_date, appointment_time, order_id, reschedule_token, orders:order_id(title, customer_id, profiles:customer_id(full_name, email))")
      .eq("status", "scheduled")
      .is(columnName, null)
      .gte("appointment_date", windowStart.toISOString().slice(0, 10))
      .lte("appointment_date", windowEnd.toISOString().slice(0, 10));

    for (const appt of candidates || []) {
      const [h, m] = appt.appointment_time.split(":").map(Number);
      const apptDateTime = new Date(`${appt.appointment_date}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`);
      if (apptDateTime < windowStart || apptDateTime > windowEnd) continue;

      const order = (appt as any).orders;
      const customer = order?.profiles;
      if (!customer?.email) continue;

      try {
        await sendPickupReminderEmail({
          toEmail: customer.email,
          customerName: customer.full_name,
          orderTitle: order.title,
          appointmentDateDisplay: new Date(appt.appointment_date + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" }),
          appointmentTimeDisplay: appt.appointment_time,
          businessAddress: settings.business_address,
          pickupInstructions: settings.pickup_instructions,
          hoursUntil,
          rescheduleUrl: `${siteUrl}/pickup/reschedule/${appt.reschedule_token}`
        });
        await admin.from("pickup_appointments").update({ [columnName]: new Date().toISOString() }).eq("id", appt.id);
        if (hoursUntil === 24) sent24h++; else sent2h++;
      } catch (err) {
        console.error(`Pickup reminder (${hoursUntil}h) failed for appointment ${appt.id}:`, err);
      }
    }
  }

  await sendRemindersFor(24, "reminder_24h_sent_at");
  if (settings.send_2hour_reminder) {
    await sendRemindersFor(2, "reminder_2h_sent_at");
  }

  return NextResponse.json({ ok: true, sent24h, sent2h });
}
