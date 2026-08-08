import { createClient } from "@/lib/supabase/server";
import ProductionCalendar from "@/components/ProductionCalendar";

export default async function CalendarPage() {
  const supabase = createClient();

  // Every active (not yet picked up) order — the calendar groups these
  // by due_date client-side. No new tables, no new columns: due_date is
  // the same field already used by Queue, Orders, Reports, and Dashboard.
  const { data: orders } = await supabase
    .from("orders")
    .select("id, title, product_type, status, due_date, price_cents, amount_paid_cents, customer_id, profiles:customer_id(full_name)")
    .neq("status", "picked_up")
    .order("due_date", { ascending: true, nullsFirst: false });

  return (
    <div>
      <h1 className="font-display text-2xl text-[#1E3A5F] mb-1">Production calendar</h1>
      <p className="text-sm text-[#1E3A5F]/60 mb-6">
        Every active order by estimated pickup date. Drag an order onto a new day to reschedule it.
      </p>
      <ProductionCalendar orders={orders || []} />
    </div>
  );
}
