import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { productLabel, statusLabel, ProductType } from "@/lib/statusSteps";

export default async function QueuePage() {
  const supabase = createClient();

  // Everything not yet picked up, soonest due date first. Orders with no
  // due date at all show up last, since there's nothing urgent to sort them by.
  const { data: orders } = await supabase
    .from("orders")
    .select("*, profiles:customer_id(full_name)")
    .neq("status", "picked_up")
    .order("due_date", { ascending: true, nullsFirst: false });

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <h1 className="font-display text-2xl text-[#1E3A5F] mb-1">Build queue</h1>
      <p className="text-sm text-[#1E3A5F]/60 mb-6">Every order still in progress, soonest due date first.</p>

      <table className="w-full bg-white border border-[#1E3A5F]/10 rounded-xl overflow-hidden text-sm">
        <thead>
          <tr className="bg-[#1E3A5F] text-white text-xs uppercase tracking-wide">
            <th className="text-left px-4 py-3">Order</th>
            <th className="text-left px-4 py-3">Customer</th>
            <th className="text-left px-4 py-3">Status</th>
            <th className="text-left px-4 py-3">Estimated completion date</th>
          </tr>
        </thead>
        <tbody>
          {orders?.map((order: any) => {
            const isOverdue = order.due_date && order.due_date < today;
            const isToday = order.due_date === today;
            return (
              <tr key={order.id} className="border-t border-[#1E3A5F]/10 hover:bg-cream/60">
                <td className="px-4 py-3">
                  <Link href={`/admin/orders/${order.id}`} className="font-semibold text-[#1E3A5F]">
                    {productLabel(order.product_type as ProductType)} — {order.title}
                  </Link>
                </td>
                <td className="px-4 py-3 text-[#1E3A5F]/70">{order.profiles?.full_name}</td>
                <td className="px-4 py-3 text-[#1E3A5F]/70">
                  {statusLabel(order.product_type as ProductType, order.status)}
                </td>
                <td className={`px-4 py-3 font-mono ${isOverdue ? "text-ember font-semibold" : isToday ? "text-sage font-semibold" : "text-[#1E3A5F]/70"}`}>
                  {order.due_date
                    ? `${new Date(order.due_date + "T00:00:00").toLocaleDateString()}${isOverdue ? " (overdue)" : isToday ? " (today)" : ""}`
                    : "—"}
                </td>
              </tr>
            );
          })}
          {(!orders || orders.length === 0) && (
            <tr><td colSpan={4} className="px-4 py-6 text-center text-[#1E3A5F]/50">Nothing in progress right now.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
