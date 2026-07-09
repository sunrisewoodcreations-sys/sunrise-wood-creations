import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { productLabel, statusLabel, ProductType } from "@/lib/statusSteps";

const SALES_TAX_RATE = 0.06; // Michigan

function easternParts(dateInput: string | Date) {
  const d = new Date(dateInput);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "numeric"
  }).formatToParts(d);
  const year = Number(parts.find(p => p.type === "year")?.value);
  const month = Number(parts.find(p => p.type === "month")?.value); // 1-12
  return { year, month };
}

export default async function AdminOrdersPage() {
  const supabase = createClient();

  const { data: orders } = await supabase
    .from("orders")
    .select("*, profiles:customer_id(full_name, email)")
    .order("created_at", { ascending: false });

  const { year: currentYear, month: currentMonth } = easternParts(new Date());
  const currentQuarter = Math.floor((currentMonth - 1) / 3); // 0-3
  const quarterLabel = `Q${currentQuarter + 1} ${currentYear}`;

  let quarterSalesCents = 0;
  let yearSalesCents = 0;

  (orders || []).forEach((order: any) => {
    const { year, month } = easternParts(order.created_at);
    const quarter = Math.floor((month - 1) / 3);

    if (year === currentYear) {
      yearSalesCents += order.price_cents || 0;
      if (quarter === currentQuarter) {
        quarterSalesCents += order.price_cents || 0;
      }
    }
  });

  const quarterSales = quarterSalesCents / 100;
  const yearSales = yearSalesCents / 100;
  const quarterTaxOwed = quarterSales * SALES_TAX_RATE;

  return (
    <div>
      <h1 className="font-display text-2xl text-walnut mb-1">Orders</h1>
      <p className="text-sm text-walnut/60 mb-6">All orders, across every customer.</p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-walnut/10 rounded-xl p-5">
          <div className="text-xs text-walnut/50 uppercase tracking-wide mb-1">{quarterLabel} sales</div>
          <div className="text-2xl font-display text-walnut">${quarterSales.toFixed(2)}</div>
        </div>
        <div className="bg-ember/5 border border-ember/20 rounded-xl p-5">
          <div className="text-xs text-walnut/50 uppercase tracking-wide mb-1">
            Sales tax owed ({quarterLabel}, 6% MI)
          </div>
          <div className="text-2xl font-display text-ember">${quarterTaxOwed.toFixed(2)}</div>
        </div>
        <div className="bg-white border border-walnut/10 rounded-xl p-5">
          <div className="text-xs text-walnut/50 uppercase tracking-wide mb-1">
            Sales year-to-date ({currentYear})
          </div>
          <div className="text-2xl font-display text-walnut">${yearSales.toFixed(2)}</div>
        </div>
      </div>

      <table className="w-full bg-white border border-walnut/10 rounded-xl overflow-hidden text-sm">
        <thead>
          <tr className="bg-sawdust text-walnut text-xs uppercase tracking-wide">
            <th className="text-left px-4 py-3">Order</th>
            <th className="text-left px-4 py-3">Customer</th>
            <th className="text-left px-4 py-3">Date</th>
            <th className="text-left px-4 py-3">Status</th>
            <th className="text-right px-4 py-3">Sales</th>
            <th className="text-right px-4 py-3">Paid</th>
            <th className="text-right px-4 py-3">Owed</th>
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
              <td className="px-4 py-3 text-right text-walnut/70">
                ${((order.price_cents || 0) / 100).toFixed(2)}
              </td>
              <td className="px-4 py-3 text-right text-walnut/70">
                ${((order.amount_paid_cents || 0) / 100).toFixed(2)}
              </td>
              <td className={`px-4 py-3 text-right font-semibold ${
                (order.price_cents || 0) - (order.amount_paid_cents || 0) > 0 ? "text-ember" : "text-sage"
              }`}>
                ${(((order.price_cents || 0) - (order.amount_paid_cents || 0)) / 100).toFixed(2)}
              </td>
            </tr>
          ))}
          {orders?.length === 0 && (
            <tr><td colSpan={7} className="px-4 py-6 text-center text-walnut/50">No orders yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
