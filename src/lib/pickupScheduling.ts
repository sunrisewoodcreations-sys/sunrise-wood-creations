import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPickupConfirmationEmail, sendPickupSchedulingEmail, sendPickupScheduledAdminAlert } from "@/lib/email";
import {
  Kind, SlotConfig, DaySlots, absMinute, absToTimestamp, dayNumber, addDays, easternNow, blockFor, computeSlots, isSlotOpen, easternToUtcMs
} from "@/lib/scheduleCore";
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

export type { DaySlots } from "@/lib/scheduleCore";

export type ScheduleKind = Kind;

function parseLocalTimestamp(ts: string): number {
  // 'YYYY-MM-DDTHH:MM:SS' (local Eastern wall clock, no timezone)
  return absMinute(ts.slice(0, 10), ts.slice(11, 16));
}

// Everything needed to decide which times are open, loaded in one place so
// the customer picker, the booking re-check, and the admin views all use
// exactly the same rules.
async function loadScheduleConfig(opts: {
  kind: Kind;
  driveMinutes: number;
  daysAhead: number;
  excludeAppointmentId?: string;
}): Promise<{ cfg: SlotConfig; onVacation: boolean }> {
  const admin = createAdminClient();
  const settings = await getAvailabilitySettings();
  const now = easternNow();
  const endStr = addDays(now.dateStr, opts.daysAhead + 1);
  const startStr = addDays(now.dateStr, -1);

  const [{ data: blockedDates }, { data: blockedTimes }, { data: existingRows }, { data: ds }] = await Promise.all([
    admin.from("pickup_blocked_dates").select("blocked_date").gte("blocked_date", now.dateStr).lte("blocked_date", endStr),
    admin.from("schedule_blocked_times").select("blocked_date, start_time, end_time").gte("blocked_date", startStr).lte("blocked_date", endStr),
    admin.from("pickup_appointments").select("id, block_start_at, block_end_at")
      .in("status", ["scheduled", "arrived"]).not("block_start_at", "is", null)
      .gte("appointment_date", startStr).lte("appointment_date", endStr),
    admin.from("delivery_settings").select("minutes_at_customer, buffer_after_minutes").eq("id", 1).maybeSingle()
  ]);

  const onVacation = settings.vacation_mode_enabled && (!settings.vacation_return_date || now.dateStr < settings.vacation_return_date);

  const cfg: SlotConfig = {
    kind: opts.kind,
    driveMinutes: opts.driveMinutes,
    availableDays: settings.available_days,
    startTime: settings.start_time.slice(0, 5),
    endTime: settings.end_time.slice(0, 5),
    slotLengthMinutes: settings.slot_length_minutes,
    minutesAtCustomer: ds?.minutes_at_customer ?? 15,
    bufferAfterMinutes: ds?.buffer_after_minutes ?? 15,
    blockedDates: new Set((blockedDates || []).map((b: any) => b.blocked_date)),
    blockedRanges: (blockedTimes || []).map((r: any) => ({ date: r.blocked_date, start: String(r.start_time).slice(0, 5), end: String(r.end_time).slice(0, 5) })),
    existing: (existingRows || [])
      .filter((r: any) => r.id !== opts.excludeAppointmentId)
      .map((r: any) => ({ start: parseLocalTimestamp(r.block_start_at), end: parseLocalTimestamp(r.block_end_at) })),
    todayStr: now.dateStr,
    nowAbs: now.abs,
    daysAhead: opts.daysAhead
  };
  return { cfg, onVacation };
}

// notBefore: customers can't book earlier than the order's estimated pickup /
// delivery date (any day on or after it is fine). Admin views leave it off.
export type SlotOptions = { kind?: Kind; driveMinutes?: number; excludeAppointmentId?: string; notBefore?: string | null };

// Computes real bookable slots for the next `daysAhead` days. One customer
// per slot, enforced by the actual blocks of time (a delivery blocks the
// drive there, the visit, the drive home and a buffer; pickups are blocked
// while you're out), plus blocked days and blocked time ranges.
export async function getAvailableSlots(daysAhead: number = 21, opts: SlotOptions = {}): Promise<DaySlots[]> {
  // The window runs from the earliest allowed date, not from today, so an
  // order due weeks from now still shows its full booking window.
  if (opts.notBefore) {
    daysAhead = Math.max(daysAhead, dayNumber(opts.notBefore) - dayNumber(easternNow().dateStr) + daysAhead);
  }
  const { cfg, onVacation } = await loadScheduleConfig({
    kind: opts.kind || "pickup", driveMinutes: opts.driveMinutes || 0, daysAhead, excludeAppointmentId: opts.excludeAppointmentId
  });
  // "Disables all scheduling UNTIL a selected return date" — availability
  // resumes automatically once that date arrives.
  if (onVacation) return [];
  const days = computeSlots(cfg);
  return opts.notBefore ? days.filter(d => d.date >= opts.notBefore!) : days;
}

// Whether a specific date+time is still actually bookable right now —
// re-checked at booking time (not just trusted from what the page
// showed on load). The database also refuses overlapping appointments
// outright, so two customers can never both get the same time.
export async function isSlotStillAvailable(dateStr: string, time: string, opts: SlotOptions = {}): Promise<boolean> {
  // The window must reach the requested date, or blocked days/times and
  // existing bookings out there would never be loaded and checked.
  const daysAhead = Math.max(1, dayNumber(dateStr) - dayNumber(easternNow().dateStr) + 1);
  const { cfg, onVacation } = await loadScheduleConfig({
    kind: opts.kind || "pickup", driveMinutes: opts.driveMinutes || 0, daysAhead, excludeAppointmentId: opts.excludeAppointmentId
  });
  if (onVacation) return false;
  if (opts.notBefore && dateStr < opts.notBefore) return false;
  return isSlotOpen(cfg, dateStr, time);
}

// The block of time (as local timestamps) an appointment uses.
async function blockColumnsFor(kind: Kind, dateStr: string, time: string, driveMinutes: number) {
  const { cfg } = await loadScheduleConfig({ kind, driveMinutes, daysAhead: 1 });
  const block = blockFor(cfg, absMinute(dateStr, time));
  return { block_start_at: absToTimestamp(block.start), block_end_at: absToTimestamp(block.end) };
}

const CONFLICT_MESSAGE = "That time is no longer available. Please choose another.";

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
  // appointment_date/time are Eastern wall-clock; compare as real instants.
  return easternToUtcMs(appt.appointment_date, appt.appointment_time.slice(0, 5)) < new Date(nowIso).getTime();
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
  // Admin manual bookings may go outside the usual hours/blocked days —
  // the database's no-overlap guard still applies either way.
  skipAvailabilityCheck?: boolean;
  // Customer bookings: nothing before the order's estimated date.
  restrictToDueDate?: boolean;
}): Promise<{ ok: true; appointmentId: string } | { ok: false; error: string }> {
  const admin = createAdminClient();

  // Pickup vs delivery, and the stored one-way drive time, come from the
  // order itself — callers never pass them, so a customer can't tamper.
  const { data: order } = await admin.from("orders").select("fulfillment_method, delivery_drive_minutes, due_date").eq("id", opts.orderId).maybeSingle();
  if (!order) return { ok: false, error: "Order not found." };
  const kind: Kind = order.fulfillment_method === "delivery" ? "delivery" : "pickup";
  const driveMinutes = order.delivery_drive_minutes ?? 0;
  if (kind === "delivery" && !(order.delivery_drive_minutes > 0)) {
    return { ok: false, error: "We need your delivery address before we can schedule." };
  }

  if (!opts.skipAvailabilityCheck) {
    const available = await isSlotStillAvailable(opts.dateStr, opts.time, { kind, driveMinutes, notBefore: opts.restrictToDueDate ? order.due_date : null });
    if (!available) return { ok: false, error: CONFLICT_MESSAGE };
  }

  const blockCols = await blockColumnsFor(kind, opts.dateStr, opts.time, driveMinutes);
  const { data: appointment, error } = await admin
    .from("pickup_appointments")
    .insert({ order_id: opts.orderId, appointment_date: opts.dateStr, appointment_time: opts.time, source: opts.source, appointment_type: kind, ...blockCols })
    .select()
    .single();

  // 23P01 = the database's no-overlap guard fired (someone else took it
  // a split second earlier).
  if (error?.code === "23P01") return { ok: false, error: CONFLICT_MESSAGE };
  if (error || !appointment) return { ok: false, error: error?.message || "Couldn't book that appointment." };
  return { ok: true, appointmentId: appointment.id };
}

// Moves an existing appointment to a new date/time, after re-validating
// availability the same way a fresh booking does. Shared by admin
// manual reschedule and the customer's reschedule action (whether from
// their email link or their logged-in account). The appointment's own
// current block never counts as a conflict with itself.
export async function reschedulePickupAppointment(opts: {
  appointmentId: string;
  dateStr: string;
  time: string;
  rescheduledBy: "customer" | "admin";
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient();

  const { data: appt } = await admin
    .from("pickup_appointments")
    .select("appointment_type, orders:order_id(delivery_drive_minutes, due_date)")
    .eq("id", opts.appointmentId).maybeSingle();
  if (!appt) return { ok: false, error: "Appointment not found." };
  const kind: Kind = appt.appointment_type === "delivery" ? "delivery" : "pickup";
  const driveMinutes = (appt as any).orders?.delivery_drive_minutes ?? 0;

  const available = await isSlotStillAvailable(opts.dateStr, opts.time, { kind, driveMinutes, excludeAppointmentId: opts.appointmentId, notBefore: opts.rescheduledBy === "customer" ? (appt as any).orders?.due_date : null });
  if (!available) return { ok: false, error: CONFLICT_MESSAGE };

  const blockCols = await blockColumnsFor(kind, opts.dateStr, opts.time, driveMinutes);
  const { error } = await admin
    .from("pickup_appointments")
    .update({
      appointment_date: opts.dateStr, appointment_time: opts.time, status: "scheduled", rescheduled_by: opts.rescheduledBy,
      ...blockCols,
      // A new time means fresh reminders, and any "on my way" no longer applies.
      reminder_24h_sent_at: null, reminder_1h_sent_at: null, reminder_2h_sent_at: null, on_my_way_at: null, follows_appointment_id: null
    })
    .eq("id", opts.appointmentId);

  if (error?.code === "23P01") return { ok: false, error: CONFLICT_MESSAGE };
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function cancelPickupAppointment(appointmentId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient();
  const { error } = await admin.from("pickup_appointments").update({ status: "cancelled" }).eq("id", appointmentId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// Shared eligibility check + token issuance for pickup scheduling —
// does NOT send any email itself. Called from every path that can put
// an order into ready_for_pickup (admin manual status change, order
// creation when stock is already on hand, and checkStockAndAutoMarkReady()'s
// automatic transition). Whichever one gets there first wins — the
// guard below (sent-at timestamp, plus any already-existing
// appointment) makes every other call a safe no-op, so the same order
// never gets a second scheduling link generated or counted as sent,
// no matter how many call sites or how many times each one fires.
// Callers that are about to send their own "your order is ready" email
// use this to get the scheduling URL and fold it into that one email
// (see sendOrderStatusEmail's schedulingUrl option) instead of sending
// a second, separate scheduling email.
export async function getOrCreatePickupSchedulingUrl(orderId: string, siteUrl: string, opts: { force?: boolean } = {}): Promise<{ ok: true; url: string } | { ok: false; reason: "not_eligible" | "no_email"; error?: string }> {
  const admin = createAdminClient();

  const { data: order } = await admin
    .from("orders")
    .select("id, fulfillment_method, pickup_scheduling_token, pickup_scheduling_token_used_at, pickup_scheduling_email_sent_at, profiles:customer_id(email)")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return { ok: false, reason: "not_eligible" };
  // Pickup and delivery orders both get a scheduling link; shipping doesn't.
  if (order.fulfillment_method !== "pickup" && order.fulfillment_method !== "delivery") return { ok: false, reason: "not_eligible" };

  const { count: existingAppointments } = await admin
    .from("pickup_appointments")
    .select("id", { count: "exact", head: true })
    .eq("order_id", orderId)
    .in("status", ["scheduled", "arrived"]);
  if ((existingAppointments || 0) > 0) return { ok: false, reason: "not_eligible" };

  // A link was already made (for instance when the order was first marked
  // ready) and nobody has used it yet: hand back that same link instead of
  // leaving it out. No second link is created, so the customer only ever
  // has one working scheduling link.
  if (order.pickup_scheduling_email_sent_at) {
    if (order.pickup_scheduling_token && !order.pickup_scheduling_token_used_at) {
      return { ok: true, url: `${siteUrl}/pickup/schedule/${order.pickup_scheduling_token}` };
    }
    // Only when the admin deliberately re-sends the email: there is no
    // active appointment (checked above), so give the customer a fresh
    // link to book again instead of leaving the button out.
    if (!opts.force) return { ok: false, reason: "not_eligible" };
    const freshToken = crypto.randomBytes(24).toString("hex");
    const { error: freshError } = await admin.from("orders").update({
      pickup_scheduling_token: freshToken,
      pickup_scheduling_token_used_at: null
    }).eq("id", orderId);
    if (freshError) return { ok: false, reason: "not_eligible", error: freshError.message };
    return { ok: true, url: `${siteUrl}/pickup/schedule/${freshToken}` };
  }

  const customer = (order as any).profiles;
  if (!customer?.email) return { ok: false, reason: "no_email", error: "This customer has no email on file." };

  const token = crypto.randomBytes(24).toString("hex");
  const { error: tokenError } = await admin.from("orders").update({
    pickup_scheduling_token: token,
    pickup_scheduling_email_sent_at: new Date().toISOString()
  }).eq("id", orderId);
  if (tokenError) return { ok: false, reason: "no_email", error: tokenError.message };

  return { ok: true, url: `${siteUrl}/pickup/schedule/${token}` };
}

// Sends the standalone, plain "schedule your pickup" email — used only
// by the admin's manual "Send Pickup Scheduling Email" action on an
// order that's already Ready for Pickup without one sent yet. The
// automatic ready_for_pickup transitions (status change, auto-stock,
// order creation) no longer call this: they fold the same scheduling
// link into their own "your order is ready" email instead, via
// getOrCreatePickupSchedulingUrl, so a customer never gets two emails
// for one event.
export async function triggerPickupSchedulingEmail(orderId: string, siteUrl: string): Promise<{ sent: boolean; error?: string }> {
  const admin = createAdminClient();
  const { data: order } = await admin.from("orders").select("id, title, fulfillment_method, profiles:customer_id(full_name, email)").eq("id", orderId).maybeSingle();
  if (!order) return { sent: false, error: "Order not found" };

  const result = await getOrCreatePickupSchedulingUrl(orderId, siteUrl);
  if (!result.ok) return { sent: false, error: result.error };

  const customer = (order as any).profiles;

  try {
    await sendPickupSchedulingEmail({
      toEmail: customer.email,
      customerName: customer.full_name,
      orderTitle: order.title,
      schedulingUrl: result.url,
      kind: order.fulfillment_method === "delivery" ? "delivery" : "pickup"
    });
  } catch (err: any) {
    return { sent: false, error: err.message || "Couldn't send the scheduling email." };
  }

  return { sent: true };
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
  const { data: appointment } = await admin.from("pickup_appointments").select("*, orders:order_id(title, customer_id, is_demo, delivery_address, profiles:customer_id(full_name, email))").eq("id", appointmentId).maybeSingle();
  if (!appointment) return { ok: false, error: "Appointment not found" };
  const isDelivery = appointment.appointment_type === "delivery";

  const order = (appointment as any).orders;
  const customer = order?.profiles;
  if (!customer?.email) return { ok: false, error: "This customer has no email on file" };

  // Called from the two public, no-login booking/reschedule routes (the
  // token itself is the authorization) — there's never a logged-in
  // session here, so this is the only real signal available. Fail-safe
  // to "treat as demo" if it's ever missing/not a boolean.
  const forceDemo = typeof order?.is_demo === "boolean" ? order.is_demo : true;

  const settings = await getAvailabilitySettings();

  const calendarEvent = {
    title: `${isDelivery ? "Delivery" : "Pickup"}: ${order.title}`,
    description: isDelivery ? "Delivery from Sunrise Wood Creations" : settings.pickup_instructions,
    location: isDelivery ? (order.delivery_address || "") : settings.business_address,
    dateStr: appointment.appointment_date,
    timeStr: appointment.appointment_time,
    durationMinutes: isDelivery ? 15 : settings.slot_length_minutes
  };

  try {
    await sendPickupConfirmationEmail({
      kind: isDelivery ? "delivery" : "pickup",
      deliveryAddress: isDelivery ? (order.delivery_address || undefined) : undefined,
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
      isReschedule,
      forceDemo
    });
  } catch (err: any) {
    return { ok: false, error: err.message || "Couldn't send the confirmation email" };
  }

  return { ok: true };
}

// Tells the shop a customer just booked or rescheduled their own pickup
// time — called only from the two customer-facing token routes
// (schedule and reschedule), never when an admin creates or changes an
// appointment themselves from the admin side, since you already know
// about those. Best-effort and silent on failure: the customer's own
// booking/confirmation has already succeeded by the time this runs, so
// a failed admin notification should never surface as an error to them.
export async function notifyAdminPickupScheduled(appointmentId: string, isReschedule: boolean): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: appointment } = await admin
      .from("pickup_appointments")
      .select("appointment_date, appointment_time, appointment_type, orders:order_id(title, is_demo, delivery_address, profiles:customer_id(full_name, phone))")
      .eq("id", appointmentId)
      .maybeSingle();
    if (!appointment) return;

    const order = (appointment as any).orders;
    const customer = order?.profiles;
    const forceDemo = typeof order?.is_demo === "boolean" ? order.is_demo : true;
    const settings = await getAvailabilitySettings();

    const calendarEvent = {
      title: `${appointment.appointment_type === "delivery" ? "Delivery" : "Pickup"}: ${order?.title || "Order"}`,
      description: settings.pickup_instructions,
      location: settings.business_address,
      dateStr: appointment.appointment_date,
      timeStr: appointment.appointment_time,
      durationMinutes: settings.slot_length_minutes
    };

    await sendPickupScheduledAdminAlert({
      kind: appointment.appointment_type === "delivery" ? "delivery" : "pickup",
      deliveryAddress: order?.delivery_address || undefined,
      orderTitle: order?.title || "Order",
      customerName: customer?.full_name || "A customer",
      customerPhone: customer?.phone || undefined,
      appointmentDateDisplay: formatDateDisplay(appointment.appointment_date),
      appointmentTimeDisplay: formatTimeDisplay(appointment.appointment_time),
      googleCalendarUrl: googleCalendarUrl(calendarEvent),
      isReschedule,
      forceDemo
    });
  } catch (err) {
    console.error("Admin pickup-scheduled alert failed to send:", err);
  }
}
