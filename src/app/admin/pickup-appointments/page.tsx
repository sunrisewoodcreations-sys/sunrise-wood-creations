import { createAdminClient } from "@/lib/supabase/admin";
import { getAvailableSlots } from "@/lib/pickupScheduling";
import PickupAppointmentsView from "@/components/PickupAppointmentsView";

// The admin-side pickup appointment management page — every upcoming
// appointment in one place, with reschedule/cancel/mark-arrived/
// mark-picked-up actions, reusing the same availability calculation
// the customer-facing scheduling page uses for the reschedule picker.
export default async function PickupAppointmentsPage() {
  const admin = createAdminClient();

  const todayStr = new Date().toISOString().slice(0, 10);
  const { data: appointments } = await admin
    .from("pickup_appointments")
    .select("*, orders:order_id(id, title, product_type, profiles:customer_id(full_name, phone))")
    .in("status", ["scheduled", "arrived"])
    .gte("appointment_date", todayStr)
    .order("appointment_date", { ascending: true })
    .order("appointment_time", { ascending: true });

  const availableDays = await getAvailableSlots(21);

  return <PickupAppointmentsView appointments={appointments || []} availableDays={availableDays} todayStr={todayStr} />;
}
