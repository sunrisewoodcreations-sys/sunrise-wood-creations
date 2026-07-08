import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { productLabel, statusLabel, ProductType } from "@/lib/statusSteps";

export default async function AdminOrdersPage() {
  const supabase = createClient();

  const { data: orders } = await supabase
    .from("orders")
    .select("*, profiles:customer_id(full_name, email)")
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 className="font-display text-2xl text-walnut mb-1">Orders</h1>
      <p className="text-sm text-walnut/60 mb-6">All orders, across every customer.</p>

      <table className="w-full bg-white border border-walnut/10 rounded-xl overflow-hidden text-sm">
        <thead>
          <tr className="bg-sawdust text-walnut text-xs uppercase tracking-wide">
            <th className="text-left px-4 py-3">Order</th>
            <th className="text-left px-4 py-3">Customer</th>
            <th className="text-left px-4 py-3">Date</th>
            <th className="text-left px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {orders?.map((order: any) => (
            <tr key={order.id} className="border-t border-walnut/10 hover:bg-cream/60">
              <td className="px-4 py-3">
                <Link href={`/admin/orders/${order.id}`} className="font-semibold text-walnut">
                  {productLabel(order.product_type as ProductType)} — {order.title}
                </Link>
              </td>
              <td className="px-4 py-3 text-walnut/70">{order.profiles?.full_name}</td>
              <td className="px-4 py-3 font-mono text-walnut/70">
                {new Date(order.created_at).toLocaleDateString()}
              </td>
              <td className="px-4 py-3 text-walnut/70">
                {statusLabel(order.product_type as ProductType, order.status)}
              </td>
            </tr>
          ))}
          {orders?.length === 0 && (
            <tr><td colSpan={4} className="px-4 py-6 text-center text-walnut/50">No orders yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
