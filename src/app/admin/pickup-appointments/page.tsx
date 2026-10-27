import { createAdminClient } from "@/lib/supabase/admin";
import { getAvailableSlots } from "@/lib/pickupScheduling";
import { easternNow } from "@/lib/scheduleCore";
import PickupAppointmentsView from "@/components/PickupAppointmentsView";

// The admin-side appointment management page — every upcoming pickup AND
// delivery in one place, with reschedule/cancel/mark-arrived/on-my-way
// actions, blocked times, and the "another stop on my way home" override.
// The reschedule picker uses the same availability rules the customer sees,
// calculated per appointment (a delivery's open times depend on its drive).
export const dynamic = "force-dynamic";

export default async function PickupAppointmentsPage() {
  const admin = createAdminClient();

  const todayStr = easternNow().dateStr;
  const { data: appointments } = await admin
    .from("pickup_appointments")
    .select("*, orders:order_id(id, title, product_type, delivery_address, delivery_drive_minutes, profiles:customer_id(full_name, phone))")
    .in("status", ["scheduled", "arrived"])
    .gte("appointment_date", todayStr)
    .order("appointment_date", { ascending: true })
    .order("appointment_time", { ascending: true });

  const slotsByAppointment: Record<string, { date: string; times: string[] }[]> = {};
  for (const a of appointments || []) {
    slotsByAppointment[a.id] = await getAvailableSlots(
      21,
      a.appointment_type === "delivery"
        ? { kind: "delivery", driveMinutes: (a as any).orders?.delivery_drive_minutes || 0, excludeAppointmentId: a.id }
        : { excludeAppointmentId: a.id }
    );
  }

  // Delivery orders that don't have an active delivery yet — candidates for
  // "add a stop on my way home".
  const { data: deliveryOrders } = await admin
    .from("orders")
    .select("id, title, delivery_address, delivery_drive_minutes, profiles:customer_id(full_name)")
    .eq("fulfillment_method", "delivery")
    .eq("status", "ready_for_pickup");
  const busyOrderIds = new Set((appointments || []).map((a: any) => a.order_id));
  const stopCandidates = (deliveryOrders || [])
    .filter((o: any) => !busyOrderIds.has(o.id))
    .map((o: any) => ({ id: o.id, title: o.title, customerName: o.profiles?.full_name || "Customer", address: o.delivery_address || "" }));

  const { data: blockedTimes } = await admin
    .from("schedule_blocked_times")
    .select("id, blocked_date, start_time, end_time, reason")
    .gte("blocked_date", todayStr)
    .order("blocked_date", { ascending: true })
    .order("start_time", { ascending: true });

  return (
    <PickupAppointmentsView
      appointments={appointments || []}
      slotsByAppointment={slotsByAppointment}
      stopCandidates={stopCandidates}
      blockedTimes={(blockedTimes || []).map((b: any) => ({ ...b, start_time: String(b.start_time).slice(0, 5), end_time: String(b.end_time).slice(0, 5) }))}
      todayStr={todayStr}
    />
  );
}
