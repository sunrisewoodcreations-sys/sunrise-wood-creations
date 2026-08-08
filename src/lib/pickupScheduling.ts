import { createAdminClient } from "@/lib/supabase/admin";
import { sendPickupConfirmationEmail } from "@/lib/email";
import { googleCalendarUrl, outlookCalendarUrl, appleCalendarDataUrl } from "@/lib/calendarLinks";

export type AvailabilitySettings = {
  id: string;
  business_address: string;
  contact_phone: string;
  pickup_instructions: string;
  available_days: number[];
  start_time: string;
  end_time: string;
  slot_length_minutes: number;
  max_pickups_per_slot: number;
  send_2hour_reminder: boolean;
  vacation_mode_enabled: boolean;
  vacation_return_date: string | null;
};

// Single settings row, created with sensible defaults on first read if
// none exists yet — same "lazily create the one row" approach already
// used for report_settings elsewhere in this app.
export async function getAvailabilitySettings(): Promise<AvailabilitySettings> {
  const admin = createAdminClient();
  const { data: existing } = await admin.from("pickup_availability_settings").select("*").limit(1).maybeSingle();
  if (existing) return existing;

  const { data: created } = await admin.from("pickup_availability_settings").insert({}).select().single();
  return created!;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// The current hour:minute in Eastern time, as minutes since midnight —
// used only to filter out today's already-passed slots, same
// timeToMinutes format as everything else in this file.
function currentEasternMinutesOfDay(): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", hour12: false
  }).formatToParts(new Date());
  const h = Number(parts.find(p => p.type === "hour")?.value) % 24;
  const m = Number(parts.find(p => p.type === "minute")?.value);
  return h * 60 + m;
}

function dateStrToWeekday(dateStr: string): number {
  // Computed directly from the date parts (UTC) rather than parsing
  // dateStr as a local Date, to avoid timezone-shift-induced off-by-one
  // weekday bugs — same care taken with dates throughout this app.
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}
function addDaysToDateStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export type DaySlots = { date: string; times: string[] };

// Computes real bookable slots for the next `daysAhead` days: only on
// configured available weekdays, not on blocked dates, split into
// slot_length_minutes increments between start_time and end_time, and
// excluding any slot that's already at max_pickups_per_slot from
// existing scheduled appointments.
export async function getAvailableSlots(daysAhead: number = 21): Promise<DaySlots[]> {
  const admin = createAdminClient();
  const settings = await getAvailabilitySettings();

  const todayStr = new Date().toISOString().slice(0, 10);
  const endStr = addDaysToDateStr(todayStr, daysAhead);

  // "Disables all scheduling UNTIL a selected return date" — once that
  // date arrives, availability resumes automatically without needing
  // the toggle switched off by hand. No return date set means closed
  // indefinitely until the admin turns it off.
  const onVacation = settings.vacation_mode_enabled && (!settings.vacation_return_date || todayStr < settings.vacation_return_date);
  if (onVacation) return [];

  const [{ data: blockedDates }, { data: existingAppointments }] = await Promise.all([
    admin.from("pickup_blocked_dates").select("blocked_date").gte("blocked_date", todayStr).lte("blocked_date", endStr),
    admin.from("pickup_appointments").select("appointment_date, appointment_time")
      .eq("status", "scheduled").gte("appointment_date", todayStr).lte("appointment_date", endStr)
  ]);

  const blockedSet = new Set((blockedDates || []).map((b: any) => b.blocked_date));
  const countBySlot = new Map<string, number>();
  (existingAppointments || []).forEach((a: any) => {
    const key = `${a.appointment_date}|${a.appointment_time}`;
    countBySlot.set(key, (countBySlot.get(key) || 0) + 1);
  });

  const startMin = timeToMinutes(settings.start_time);
  const endMin = timeToMinutes(settings.end_time);
  const allTimes: string[] = [];
  for (let m = startMin; m < endMin; m += settings.slot_length_minutes) {
    allTimes.push(minutesToTime(m));
  }

  const days: DaySlots[] = [];
  for (let i = 0; i <= daysAhead; i++) {
    const dateStr = addDaysToDateStr(todayStr, i);
    if (blockedSet.has(dateStr)) continue;
    if (!settings.available_days.includes(dateStrToWeekday(dateStr))) continue;

    let openTimes = allTimes.filter(t => (countBySlot.get(`${dateStr}|${t}`) || 0) < settings.max_pickups_per_slot);

    // For today specifically, also exclude any time that's already
    // passed — otherwise a customer opening this page in the afternoon
    // would see (and could book) a slot from earlier that morning,
    // which is what actually surfaced this during testing.
    if (dateStr === todayStr) {
      const nowEasternMinutes = currentEasternMinutesOfDay();
      openTimes = openTimes.filter(t => timeToMinutes(t) > nowEasternMinutes);
    }

    if (openTimes.length > 0) days.push({ date: dateStr, times: openTimes });
  }

  return days;
}

// Whether a specific date+time is still actually bookable right now —
// re-checked at booking time (not just trusted from what the page
// showed on load), so two customers can't both grab the same slot.
export async function isSlotStillAvailable(dateStr: string, time: string): Promise<boolean> {
  const admin = createAdminClient();
  const settings = await getAvailabilitySettings();

  const todayStr = new Date().toISOString().slice(0, 10);
  const onVacation = settings.vacation_mode_enabled && (!settings.vacation_return_date || todayStr < settings.vacation_return_date);
  if (onVacation) return false;

  const { data: blocked } = await admin.from("pickup_blocked_dates").select("id").eq("blocked_date", dateStr).maybeSingle();
  if (blocked) return false;
  if (!settings.available_days.includes(dateStrToWeekday(dateStr))) return false;
  if (dateStr === todayStr && timeToMinutes(time) <= currentEasternMinutesOfDay()) return false;

  const { count } = await admin.from("pickup_appointments")
    .select("id", { count: "exact", head: true })
    .eq("appointment_date", dateStr).eq("appointment_time", time).eq("status", "scheduled");

  return (count || 0) < settings.max_pickups_per_slot;
}

// The admin-only, computed pickup-scheduling badge for an order —
// never stored, always derived from the order's scheduling-email
// timestamp and its most recent appointment row. Deliberately separate
// from orders.status, which stays "ready_for_pickup" throughout, so
// nothing that already keys off that status (progress bars, existing
// emails, invoice generation) is affected by any of this.
export type PickupBadgeState =
  | "not_applicable"
  | "waiting_to_schedule"
  | "scheduling_email_sent"
  | "pickup_scheduled"
  | "customer_rescheduled"
  | "pickup_today"
  | "customer_arrived"
  | "picked_up"
  | "no_show";

export const PICKUP_BADGE_LABELS: Record<PickupBadgeState, string> = {
  not_applicable: "—",
  waiting_to_schedule: "Waiting to Schedule",
  scheduling_email_sent: "Scheduling Email Sent",
  pickup_scheduled: "Pickup Scheduled",
  customer_rescheduled: "Customer Rescheduled",
  pickup_today: "Pickup Today",
  customer_arrived: "Customer Arrived",
  picked_up: "Picked Up",
  no_show: "No Show"
};

export const PICKUP_BADGE_STYLES: Record<PickupBadgeState, string> = {
  not_applicable: "bg-[#1E3A5F]/5 text-[#1E3A5F]/30",
  waiting_to_schedule: "bg-amber/20 text-amber",
  scheduling_email_sent: "bg-amber/30 text-amber",
  pickup_scheduled: "bg-sage/20 text-sage",
  customer_rescheduled: "bg-[#1E3A5F]/15 text-[#1E3A5F]",
  pickup_today: "bg-sage text-white",
  customer_arrived: "bg-[#1E3A5F] text-white",
  picked_up: "bg-[#1E3A5F]/10 text-[#1E3A5F]/50",
  no_show: "bg-ember/20 text-ember"
};

type AppointmentForBadge = {
  status: string;
  appointment_date: string;
  appointment_time: string;
  rescheduled_by: string | null;
} | null;

// A scheduled appointment whose date+time has already passed, but that
// nobody has manually closed out (marked Arrived / Picked Up / No
// Show), is auto-flagged as an overdue no-show for display — so a
// missed appointment stands out immediately instead of silently
// sitting as "Pickup Scheduled" until someone happens to notice.
export function isAppointmentOverdue(appt: AppointmentForBadge, nowIso: string): boolean {
  if (!appt || appt.status !== "scheduled") return false;
  const [h, m] = appt.appointment_time.split(":").map(Number);
  const apptDateTime = new Date(`${appt.appointment_date}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`);
  return apptDateTime.getTime() < new Date(nowIso).getTime();
}

export function getPickupBadgeState(
  orderStatus: string,
  fulfillmentMethod: string,
  schedulingEmailSentAt: string | null,
  appointment: AppointmentForBadge,
  todayStr: string,
  nowIso: string = new Date().toISOString()
): PickupBadgeState {
  if (fulfillmentMethod !== "pickup") return "not_applicable";
  if (orderStatus !== "ready_for_pickup") return "not_applicable";

  if (appointment) {
    if (appointment.status === "arrived") return "customer_arrived";
    if (appointment.status === "completed") return "picked_up";
    if (appointment.status === "missed") return "no_show";
    if (appointment.status === "scheduled") {
      if (isAppointmentOverdue(appointment, nowIso)) return "no_show";
      if (appointment.rescheduled_by === "customer") return "customer_rescheduled";
      if (appointment.appointment_date === todayStr) return "pickup_today";
      return "pickup_scheduled";
    }
    // status === "cancelled" falls through to the no-appointment cases below
  }

  return schedulingEmailSentAt ? "scheduling_email_sent" : "waiting_to_schedule";
}

export type AppointmentSource = "customer_token_link" | "customer_account" | "admin_manual";

// Creates a new appointment for an order, after re-validating the slot
// is still actually open (never trusts what the page showed on load).
// Shared by the email-link scheduling page and the logged-in customer
// portal — the only difference between those two callers is which
// `source` value they pass and how they authorized the request in the
// first place; the actual booking logic itself is identical either way.
export async function bookPickupAppointment(opts: {
  orderId: string;
  dateStr: string;
  time: string;
  source: AppointmentSource;
}): Promise<{ ok: true; appointmentId: string } | { ok: false; error: string }> {
  const admin = createAdminClient();

  const available = await isSlotStillAvailable(opts.dateStr, opts.time);
  if (!available) return { ok: false, error: "That time is no longer available. Please choose another." };

  const { data: appointment, error } = await admin
    .from("pickup_appointments")
    .insert({ order_id: opts.orderId, appointment_date: opts.dateStr, appointment_time: opts.time, source: opts.source })
    .select()
    .single();

  if (error || !appointment) return { ok: false, error: error?.message || "Couldn't book that appointment." };
  return { ok: true, appointmentId: appointment.id };
}

// Moves an existing appointment to a new date/time, after re-validating
// availability the same way a fresh booking does. Shared by admin
// manual reschedule and the customer's reschedule action (whether from
// their email link or their logged-in account).
export async function reschedulePickupAppointment(opts: {
  appointmentId: string;
  dateStr: string;
  time: string;
  rescheduledBy: "customer" | "admin";
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient();

  const available = await isSlotStillAvailable(opts.dateStr, opts.time);
  if (!available) return { ok: false, error: "That time is no longer available. Please choose another." };

  const { error } = await admin
    .from("pickup_appointments")
    .update({ appointment_date: opts.dateStr, appointment_time: opts.time, status: "scheduled", rescheduled_by: opts.rescheduledBy })
    .eq("id", opts.appointmentId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function cancelPickupAppointment(appointmentId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient();
  const { error } = await admin.from("pickup_appointments").update({ status: "cancelled" }).eq("id", appointmentId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

function formatDateDisplay(dateStr: string): string {
  return new Date(dateStr + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}
function formatTimeDisplay(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

// Sends the confirmation email for an appointment — same function
// whether it's a brand new booking or a reschedule, since the content
// only differs by one boolean. Pulls the order, customer, and business
// settings itself so every caller (the public booking route, the
// public reschedule route, and the admin manual-reschedule route) just
// passes an appointment id and gets the same correct email.
export async function sendPickupConfirmation(appointmentId: string, siteUrl: string, isReschedule: boolean): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient();
  const { data: appointment } = await admin.from("pickup_appointments").select("*, orders:order_id(title, customer_id, profiles:customer_id(full_name, email))").eq("id", appointmentId).maybeSingle();
  if (!appointment) return { ok: false, error: "Appointment not found" };

  const order = (appointment as any).orders;
  const customer = order?.profiles;
  if (!customer?.email) return { ok: false, error: "This customer has no email on file" };

  const settings = await getAvailabilitySettings();

  const calendarEvent = {
    title: `Pickup: ${order.title}`,
    description: settings.pickup_instructions,
    location: settings.business_address,
    dateStr: appointment.appointment_date,
    timeStr: appointment.appointment_time,
    durationMinutes: settings.slot_length_minutes
  };

  try {
    await sendPickupConfirmationEmail({
      toEmail: customer.email,
      customerName: customer.full_name,
      orderTitle: order.title,
      appointmentDateDisplay: formatDateDisplay(appointment.appointment_date),
      appointmentTimeDisplay: formatTimeDisplay(appointment.appointment_time),
      businessAddress: settings.business_address,
      pickupInstructions: settings.pickup_instructions,
      contactPhone: settings.contact_phone,
      rescheduleUrl: `${siteUrl}/pickup/reschedule/${appointment.reschedule_token}`,
      googleCalendarUrl: googleCalendarUrl(calendarEvent),
      outlookCalendarUrl: outlookCalendarUrl(calendarEvent),
      appleCalendarUrl: appleCalendarDataUrl(calendarEvent),
      isReschedule
    });
  } catch (err: any) {
    return { ok: false, error: err.message || "Couldn't send the confirmation email" };
  }

  return { ok: true };
}
