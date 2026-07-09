import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { productLabel, statusLabel, ProductType } from "@/lib/statusSteps";
import AddOrderWithCustomerPicker from "@/components/AddOrderWithCustomerPicker";
import DeleteOrderButton from "@/components/DeleteOrderButton";

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

export default async function AdminOrdersPage({ searchParams }: { searchParams: { q?: string } }) {
  const supabase = createClient();
  const query = searchParams.q?.trim() || "";

  let ordersQuery = supabase
    .from("orders")
    .select("*, profiles:customer_id!inner(full_name, email)")
    .order("created_at", { ascending: false });

  if (query) {
    ordersQuery = ordersQuery.or(
      `full_name.ilike.%${query}%,email.ilike.%${query}%`,
      { foreignTable: "profiles" }
    );
  }

  const { data: orders } = await ordersQuery;

  const { data: allCustomers } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("role", "customer")
    .order("full_name");

  const { data: savedProducts } = await supabase
    .from("products")
    .select("id, product_type, name, size_details, price_cents")
    .order("name");

  const orderIds = (orders || []).map((o: any) => o.id);

  const { data: invoices } = orderIds.length > 0
    ? await supabase
        .from("invoices")
        .select("*")
        .in("order_id", orderIds)
        .order("created_at", { ascending: false })
    : { data: [] as any[] };

  const latestInvoiceByOrder: Record<string, any> = {};
  (invoices || []).forEach((inv: any) => {
    if (!latestInvoiceByOrder[inv.order_id]) {
      latestInvoiceByOrder[inv.order_id] = inv;
    }
  });

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

  const quarterGross = quarterSalesCents / 100;
  const yearGross = yearSalesCents / 100;

  // Prices already include the 6% tax rather than adding it on top,
  // so back it out: gross ÷ 1.06 = the actual sale amount, and the
  // difference between gross and that is what's owed to the state.
  const quarterSales = quarterGross / (1 + SALES_TAX_RATE);
  const yearSales = yearGross / (1 + SALES_TAX_RATE);
  const quarterTaxOwed = quarterGross - quarterSales;

  return (
    <div>
      <h1 className="font-display text-2xl text-walnut mb-1">Orders</h1>
      <p className="text-sm text-walnut/60 mb-6">All orders, across every customer.</p>

      <div className="bg-white border border-walnut/10 rounded-xl p-5 mb-6">
        <div className="text-xs text-walnut/50 uppercase tracking-wide mb-3">Download invoices in bulk (paid orders only)</div>
        <div className="flex flex-wrap gap-2">
          <a href="/api/invoices/bulk?period=this_month" className="border border-walnut/20 text-walnut px-3 py-1.5 rounded-md text-xs font-semibold hover:bg-cream">This month</a>
          <a href="/api/invoices/bulk?period=this_quarter" className="border border-walnut/20 text-walnut px-3 py-1.5 rounded-md text-xs font-semibold hover:bg-cream">This quarter</a>
          <a href="/api/invoices/bulk?period=last_quarter" className="border border-walnut/20 text-walnut px-3 py-1.5 rounded-md text-xs font-semibold hover:bg-cream">Last quarter</a>
          <a href="/api/invoices/bulk?period=this_year" className="border border-walnut/20 text-walnut px-3 py-1.5 rounded-md text-xs font-semibold hover:bg-cream">This year</a>
          <a href="/api/invoices/bulk?period=last_year" className="border border-walnut/20 text-walnut px-3 py-1.5 rounded-md text-xs font-semibold hover:bg-cream">Last year</a>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-walnut/10 rounded-xl p-5">
          <div className="text-xs text-walnut/50 uppercase tracking-wide mb-1">
            {quarterLabel} sales (after tax removed)
          </div>
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
            Sales year-to-date ({currentYear}, after tax removed)
          </div>
          <div className="text-2xl font-display text-walnut">${yearSales.toFixed(2)}</div>
        </div>
      </div>


      <div className="flex flex-wrap items-center gap-3 mb-4">
        <AddOrderWithCustomerPicker customers={allCustomers || []} products={savedProducts || []} />

        <form method="GET" className="flex-1 min-w-[240px]">
          <input
            name="q"
            defaultValue={query}
            placeholder="Search orders by customer name or email..."
            className="w-full px-3 py-2.5 border border-walnut/15 rounded-md text-sm"
          />
        </form>
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
            <th className="text-left px-4 py-3">Invoice</th>
            <th className="text-right px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {orders?.map((order: any) => {
            const invoice = latestInvoiceByOrder[order.id];
            return (
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
              <td className="px-4 py-3">
                {invoice?.pdf_url ? (
                  <a
                    href={invoice.pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold text-ember hover:underline"
                  >
                    Download #{invoice.invoice_number}
                  </a>
                ) : (
                  <span className="text-xs text-walnut/40">—</span>
                )}
              </td>
              <td className="px-4 py-3 text-right">
                <DeleteOrderButton orderId={order.id} orderTitle={order.title} />
              </td>
            </tr>
          );})}
          {orders?.length === 0 && (
            <tr><td colSpan={9} className="px-4 py-6 text-center text-walnut/50">No orders yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
