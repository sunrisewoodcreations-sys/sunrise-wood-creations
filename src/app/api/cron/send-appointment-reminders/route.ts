import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPickupReminderEmail } from "@/lib/email";
import { getAvailabilitySettings } from "@/lib/pickupScheduling";
import { easternToUtcMs } from "@/lib/scheduleCore";

// Reminder emails for pickups AND deliveries:
//   - one the day before (24 hours ahead) — skipped when the customer
//     booked less than 24 hours before the appointment, since the
//     booking confirmation already covers it;
//   - one about 1 hour before.
// Each is sent once (reminder_24h_sent_at / reminder_1h_sent_at), so it is
// safe to call this as often as you like. It is meant to be called every
// 10-15 minutes by the Supabase scheduler (pg_cron) — see
// supabase/migrations_schedule_reminders_cron.sql. Vercel's free plan only
// allows daily cron jobs, which is too coarse for a 1-hour reminder.
//
// Protected by the same CRON_SECRET as the other cron routes.
export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const settings = await getAvailabilitySettings();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.sunrisewoodcreations.com";
  const nowMs = Date.now();

  const { data: candidates } = await admin
    .from("pickup_appointments")
    .select("id, appointment_date, appointment_time, appointment_type, reschedule_token, created_at, reminder_24h_sent_at, reminder_1h_sent_at, orders:order_id!inner(title, is_demo, delivery_address, profiles:customer_id(full_name, email))")
    .eq("status", "scheduled")
    .eq("orders.is_demo", false)
    .gte("appointment_date", new Date(nowMs - 86400000).toISOString().slice(0, 10))
    .lte("appointment_date", new Date(nowMs + 3 * 86400000).toISOString().slice(0, 10));

  let sent24h = 0;
  let sent1h = 0;

  for (const appt of candidates || []) {
    const order = (appt as any).orders;
    // Never act on test/demo records (same fail-safe as the old reminder job).
    if (order?.is_demo !== false) continue;
    const customer = order?.profiles;
    if (!customer?.email) continue;

    const apptMs = easternToUtcMs(appt.appointment_date, String(appt.appointment_time).slice(0, 5));
    const msUntil = apptMs - nowMs;
    if (msUntil <= 0) continue; // already started/passed

    const createdMs = new Date(appt.created_at).getTime();
    const bookedWithin24h = apptMs - createdMs < 24 * 3600000;

    let due: { hoursUntil: 24 | 1; column: "reminder_24h_sent_at" | "reminder_1h_sent_at" } | null = null;
    if (!appt.reminder_1h_sent_at && msUntil <= 60 * 60000 + 5 * 60000) {
      // About an hour out (a little slack so a 10-15 minute schedule can't miss it)
      due = { hoursUntil: 1, column: "reminder_1h_sent_at" };
    } else if (!appt.reminder_24h_sent_at && !bookedWithin24h && msUntil <= 24 * 3600000 && msUntil > 2 * 3600000) {
      due = { hoursUntil: 24, column: "reminder_24h_sent_at" };
    }
    if (!due) continue;

    // If a 1-hour reminder is going out, mark any unsent 24h one as covered
    // so it can never fire late, right on top of it.
    const isDelivery = appt.appointment_type === "delivery";
    try {
      await sendPickupReminderEmail({
        toEmail: customer.email,
        customerName: customer.full_name,
        orderTitle: order.title,
        appointmentDateDisplay: new Date(appt.appointment_date + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" }),
        appointmentTimeDisplay: formatTime(String(appt.appointment_time)),
        businessAddress: settings.business_address,
        pickupInstructions: settings.pickup_instructions,
        hoursUntil: due.hoursUntil,
        rescheduleUrl: `${siteUrl}/pickup/reschedule/${appt.reschedule_token}`,
        forceDemo: false,
        kind: isDelivery ? "delivery" : "pickup",
        deliveryAddress: order.delivery_address || undefined
      });
      const stamp = new Date().toISOString();
      await admin.from("pickup_appointments").update(
        due.hoursUntil === 1 ? { reminder_1h_sent_at: stamp, reminder_24h_sent_at: appt.reminder_24h_sent_at || stamp } : { [due.column]: stamp }
      ).eq("id", appt.id);
      if (due.hoursUntil === 24) sent24h++; else sent1h++;
    } catch (err) {
      console.error(`Appointment reminder (${due.hoursUntil}h) failed for ${appt.id}:`, err);
    }
  }

  return NextResponse.json({ ok: true, sent24h, sent1h });
}

function formatTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}
