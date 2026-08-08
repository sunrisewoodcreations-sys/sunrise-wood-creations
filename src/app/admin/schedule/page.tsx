import { createClient } from "@/lib/supabase/server";
import ProductionSchedule from "@/components/ProductionSchedule";

export default async function SchedulePage() {
  const supabase = createClient();

  const [{ data: orders }, { data: pendingProofs }, { data: pickupAppointments }] = await Promise.all([
    supabase
      .from("orders")
      .select("*, profiles:customer_id(full_name)")
      .neq("status", "picked_up")
      .order("production_date", { ascending: true, nullsFirst: false }),
    supabase.from("proofs").select("order_id").eq("status", "pending"),
    // Safe even before the pickup scheduling migration has been run —
    // Supabase returns a null-data error rather than throwing.
    supabase
      .from("pickup_appointments")
      .select("id, order_id, appointment_date, appointment_time, status, orders:order_id(title, profiles:customer_id(full_name))")
      .eq("status", "scheduled")
  ]);

  // Recently completed (production_status = completed), shown in their
  // own section below — fetched separately since they're excluded from
  // the main active-orders query above once truly picked up, but an
  // order can be production-complete while still waiting for pickup.
  const { data: completedOrders } = await supabase
    .from("orders")
    .select("*, profiles:customer_id(full_name)")
    .eq("production_status", "completed")
    .order("production_date", { ascending: false })
    .limit(30);

  return (
    <ProductionSchedule
      orders={orders || []}
      completedOrders={completedOrders || []}
      waitingOnCustomerOrderIds={(pendingProofs || []).map((p: any) => p.order_id)}
      pickupAppointments={pickupAppointments || []}
    />
  );
}
