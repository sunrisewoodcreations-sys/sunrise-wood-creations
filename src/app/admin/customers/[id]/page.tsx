import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatInvoiceNumber } from "@/lib/invoice";
import { productLabel, statusLabel, statusColor, ProductType } from "@/lib/statusSteps";
import AddOrderWithCustomerPicker from "@/components/AddOrderWithCustomerPicker";
import CustomerNotes from "@/components/CustomerNotes";
import EditCustomerContactForm from "@/components/EditCustomerContactForm";
import CustomerQuickActions from "@/components/CustomerQuickActions";
import OrderTimeline from "@/components/OrderTimeline";
import { getCustomerTimeline } from "@/lib/orderTimeline";

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

  const { data: savedProducts } = await supabase
    .from("products")
    .select("id, product_type, name, size_details, price_cents")
    .order("name");

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
  const activeOrders = orderList.filter((o: any) => o.status !== "picked_up").length;
  const outstandingBalanceCents = orderList.reduce(
    (sum: number, o: any) => sum + Math.max(0, (o.price_cents || 0) - (o.amount_paid_cents || 0)),
    0
  );

  const customerTimeline = await getCustomerTimeline(
    params.id,
    orderList.map((o: any) => ({ id: o.id, title: o.title, product_type: o.product_type }))
  );

  return (
    <div>
      <Link href="/admin/customers" className="text-sm text-[#1E3A5F]/60 mb-4 inline-block">← All customers</Link>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
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
        <AddOrderWithCustomerPicker
          products={savedProducts || []}
          fixedCustomerId={customer.id}
          fixedCustomerName={customer.full_name}
        />
      </div>

      <CustomerQuickActions
        orders={orderList}
        customerEmail={customer.email}
        customerName={customer.full_name}
        hasRealEmail={customer.has_real_email !== false}
      />

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-8">
        <StatCard label="Lifetime value" value={`$${(lifetimeRevenueCents / 100).toFixed(2)}`} color="text-sage" />
        <StatCard label="Outstanding balance" value={`$${(outstandingBalanceCents / 100).toFixed(2)}`} color={outstandingBalanceCents > 0 ? "text-ember" : "text-sage"} />
        <StatCard label="Total orders" value={String(totalOrders)} />
        <StatCard label="Active orders" value={String(activeOrders)} color={activeOrders > 0 ? "text-amber" : undefined} />
        <StatCard label="Completed orders" value={String(completedOrders)} color="text-sage" />
        <StatCard label="Avg order value" value={`$${(avgOrderValueCents / 100).toFixed(2)}`} />
        <StatCard label="First order" value={firstOrderDate ? new Date(firstOrderDate).toLocaleDateString() : "—"} />
        <StatCard label="Last order" value={lastOrderDate ? new Date(lastOrderDate).toLocaleDateString() : "—"} />
      </div>

      {customer.has_real_email !== false && (
        <div className="bg-white border border-[#1E3A5F]/10 rounded-xl shadow-sm p-5 mb-6">
          <h2 className="font-display text-lg text-[#1E3A5F] mb-1">Email preferences</h2>
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

      <div className="mb-6">
        <CustomerNotes customerId={customer.id} />
      </div>

      <h2 className="font-display text-lg text-[#1E3A5F] mb-2">Order history</h2>
      <div className="hidden md:block overflow-x-auto overflow-y-hidden bg-white border border-[#1E3A5F]/10 rounded-xl shadow-sm">
        <table className="w-full text-sm">
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
                        Download #{formatInvoiceNumber(invoice.invoice_year, invoice.invoice_number)}
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

      {/* Mobile card view — separate from the desktop table above (which
          is untouched), same data, same invoice links. */}
      <div className="md:hidden space-y-3">
        {orderList.map((order: any) => {
          const invoice = latestInvoiceByOrder[order.id];
          const balanceCents = (order.price_cents || 0) - (order.amount_paid_cents || 0);
          return (
            <div key={order.id} className="bg-white border border-[#1E3A5F]/10 rounded-xl shadow-sm p-4">
              <Link href={`/admin/orders/${order.id}`} className="text-sm font-semibold text-[#1E3A5F] active:underline block mb-1">
                {productLabel(order.product_type as ProductType)} — {order.title}
              </Link>
              <div className="text-xs text-[#1E3A5F]/60 mb-2">{new Date(order.created_at).toLocaleDateString()}</div>
              <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${statusColor(order.status)}`}>
                {statusLabel(order.product_type as ProductType, order.status)}
              </span>
              <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-[#1E3A5F]/10 text-sm">
                <div>
                  <div className="text-[10px] text-[#1E3A5F]/50 uppercase font-semibold">Sales</div>
                  <div className="text-[#1E3A5F]/70">${((order.price_cents || 0) / 100).toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-[#1E3A5F]/50 uppercase font-semibold">Paid</div>
                  <div className="text-[#1E3A5F]/70">${((order.amount_paid_cents || 0) / 100).toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-[#1E3A5F]/50 uppercase font-semibold">Owed</div>
                  <div className={`font-semibold ${balanceCents > 0 ? "text-ember" : "text-sage"}`}>${(balanceCents / 100).toFixed(2)}</div>
                </div>
              </div>
              {invoice?.pdf_url && (
                <a
                  href={invoice.pdf_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-3 text-xs font-semibold text-ember active:underline"
                >
                  Download invoice #{formatInvoiceNumber(invoice.invoice_year, invoice.invoice_number)}
                </a>
              )}
            </div>
          );
        })}
        {orderList.length === 0 && (
          <div className="bg-white border border-[#1E3A5F]/10 rounded-xl shadow-sm px-4 py-6 text-center text-sm text-[#1E3A5F]/50">
            No orders yet.
          </div>
        )}
      </div>

      <div className="mt-6">
        <OrderTimeline
          events={customerTimeline}
          title="Customer activity timeline"
          subtitle="Every event across all of this customer's orders — status changes, payments, messages, and more — newest first."
          showOrderLabel
        />
      </div>
    </div>
  );
}
