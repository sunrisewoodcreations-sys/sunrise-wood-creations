import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { productLabel, statusLabel, statusColor, ProductType } from "@/lib/statusSteps";
import AddOrderForm from "@/components/AddOrderForm";
import CustomerNotes from "@/components/CustomerNotes";
import EditCustomerContactForm from "@/components/EditCustomerContactForm";

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-white border border-[#1E3A5F]/10 rounded-xl p-4 shadow-sm">
      <div className="text-xs text-[#1E3A5F]/50 uppercase tracking-wide mb-1">{label}</div>
      <div className={`text-xl font-display ${color || "text-[#1E3A5F]"}`}>{value}</div>
    </div>
  );
}

export default async function CustomerDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  // Look up the existing customer by id — this page only ever reads and
  // edits an existing profile, it never creates a new one, so there's no
  // way for this to produce a duplicate customer record.
  const { data: customer } = await supabase.from("profiles").select("*").eq("id", params.id).single();
  if (!customer) notFound();

  const { data: orders } = await supabase
    .from("orders")
    .select("*")
    .eq("customer_id", params.id)
    .order("created_at", { ascending: false });

  const orderList = orders || [];
  const orderIds = orderList.map((o: any) => o.id);

  const { data: invoices } = orderIds.length > 0
    ? await supabase
        .from("invoices")
        .select("*")
        .in("order_id", orderIds)
        .order("created_at", { ascending: false })
    : { data: [] as any[] };

  // Keep only the most recent invoice per order, since that's the one
  // worth linking to from this list view.
  const latestInvoiceByOrder: Record<string, any> = {};
  (invoices || []).forEach((inv: any) => {
    if (!latestInvoiceByOrder[inv.order_id]) {
      latestInvoiceByOrder[inv.order_id] = inv;
    }
  });

  // --- CRM-style summary stats, computed from every order this customer
  // has ever placed (this is a relationship overview, not a tax report —
  // deliberately not restricted to "picked up" orders the way Reports is). ---
  const totalOrders = orderList.length;
  const lifetimeRevenueCents = orderList.reduce((sum: number, o: any) => sum + (o.price_cents || 0), 0);
  const avgOrderValueCents = totalOrders > 0 ? Math.round(lifetimeRevenueCents / totalOrders) : 0;
  // orderList is sorted newest-first, so the last entry is the earliest order.
  const firstOrderDate = totalOrders > 0 ? orderList[totalOrders - 1].created_at : null;
  const lastOrderDate = totalOrders > 0 ? orderList[0].created_at : null;
  const completedOrders = orderList.filter((o: any) => o.status === "picked_up").length;
  const outstandingBalanceCents = orderList.reduce(
    (sum: number, o: any) => sum + Math.max(0, (o.price_cents || 0) - (o.amount_paid_cents || 0)),
    0
  );

  return (
    <div>
      <Link href="/admin/customers" className="text-sm text-[#1E3A5F]/60 mb-4 inline-block">← All customers</Link>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-2xl text-[#1E3A5F] mb-1">{customer.full_name}</h1>
          <p className="text-sm text-[#1E3A5F]/60 mb-3">
            {customer.has_real_email === false ? <span className="italic">No email on file</span> : customer.email}
          </p>
          <EditCustomerContactForm
            customerId={customer.id}
            initialPhone={customer.phone}
            initialAddress={customer.address}
          />
        </div>
        <AddOrderForm customerId={customer.id} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
        <StatCard label="Lifetime value" value={`$${(lifetimeRevenueCents / 100).toFixed(2)}`} color="text-sage" />
        <StatCard label="Total orders" value={String(totalOrders)} />
        <StatCard label="Completed orders" value={String(completedOrders)} color="text-sage" />
        <StatCard label="Avg order value" value={`$${(avgOrderValueCents / 100).toFixed(2)}`} />
        <StatCard label="Outstanding balance" value={`$${(outstandingBalanceCents / 100).toFixed(2)}`} color={outstandingBalanceCents > 0 ? "text-ember" : "text-sage"} />
        <StatCard label="First order" value={firstOrderDate ? new Date(firstOrderDate).toLocaleDateString() : "—"} />
        <StatCard label="Last order" value={lastOrderDate ? new Date(lastOrderDate).toLocaleDateString() : "—"} />
      </div>

      {customer.has_real_email !== false && (
        <div className="bg-white border border-[#1E3A5F]/10 rounded-xl p-5 mb-6">
          <h3 className="text-sm font-semibold text-[#1E3A5F] mb-1">Their email preferences</h3>
          <p className="text-xs text-[#1E3A5F]/50 mb-3">
            Set by the customer themselves — read-only here. If something's off, you'll need to message them directly instead of relying on an automatic email.
          </p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {[
              { label: "Order status updates", on: customer.notify_order_updates },
              { label: "Invoices", on: customer.notify_invoices },
              { label: "Design proofs", on: customer.notify_proofs },
              { label: "Messages from you", on: customer.notify_messages }
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between border border-[#1E3A5F]/10 rounded-md px-3 py-2">
                <span className="text-[#1E3A5F]/80">{item.label}</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${item.on ? "bg-sage/20 text-sage" : "bg-ember/20 text-ember"}`}>
                  {item.on ? "ON" : "OFF"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <CustomerNotes customerId={customer.id} />

      <h2 className="font-display text-lg text-[#1E3A5F] mb-2 mt-2">Order history</h2>
      <div className="overflow-x-auto">
        <table className="w-full bg-white border border-[#1E3A5F]/10 rounded-xl overflow-hidden text-sm">
          <thead>
            <tr className="bg-[#1E3A5F] text-white text-xs uppercase tracking-wide">
              <th className="text-left px-4 py-3">Order</th>
              <th className="text-left px-4 py-3">Date</th>
              <th className="text-left px-4 py-3">Size / details</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-right px-4 py-3">Sales</th>
              <th className="text-right px-4 py-3">Paid</th>
              <th className="text-right px-4 py-3">Owed</th>
              <th className="text-left px-4 py-3">Invoice</th>
            </tr>
          </thead>
          <tbody>
            {orderList.map((order: any) => {
              const invoice = latestInvoiceByOrder[order.id];
              return (
                <tr key={order.id} className="border-t border-[#1E3A5F]/10 hover:bg-cream/60 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/admin/orders/${order.id}`} className="font-semibold text-[#1E3A5F] hover:underline">
                      {productLabel(order.product_type as ProductType)} — {order.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono text-[#1E3A5F]/70">
                    {new Date(order.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-[#1E3A5F]/70">{order.size_details}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${statusColor(order.status)}`}>
                      {statusLabel(order.product_type as ProductType, order.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-[#1E3A5F]/70">
                    ${((order.price_cents || 0) / 100).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right text-[#1E3A5F]/70">
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
                      <span className="text-xs text-[#1E3A5F]/40">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {orderList.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-[#1E3A5F]/50">No orders yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
