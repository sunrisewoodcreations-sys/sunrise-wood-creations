import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { productLabel, statusLabel, ProductType } from "@/lib/statusSteps";
import AddOrderForm from "@/components/AddOrderForm";

export default async function CustomerDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: customer } = await supabase.from("profiles").select("*").eq("id", params.id).single();
  if (!customer) notFound();

  const { data: orders } = await supabase
    .from("orders")
    .select("*")
    .eq("customer_id", params.id)
    .order("created_at", { ascending: false });

  const orderIds = (orders || []).map((o: any) => o.id);

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

  return (
    <div>
      <Link href="/admin/customers" className="text-sm text-[#1E3A5F]/60 mb-4 inline-block">← All customers</Link>
      <h1 className="font-display text-2xl text-[#1E3A5F] mb-1">{customer.full_name}</h1>
      <p className="text-sm text-[#1E3A5F]/60 mb-6">{customer.email}</p>

      <AddOrderForm customerId={customer.id} />

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
          {orders?.map((order: any) => {
            const invoice = latestInvoiceByOrder[order.id];
            return (
              <tr key={order.id} className="border-t border-[#1E3A5F]/10 hover:bg-cream/60">
                <td className="px-4 py-3">
                  <Link href={`/admin/orders/${order.id}`} className="font-semibold text-[#1E3A5F]">
                    {productLabel(order.product_type as ProductType)} — {order.title}
                  </Link>
                </td>
                <td className="px-4 py-3 font-mono text-[#1E3A5F]/70">
                  {new Date(order.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-[#1E3A5F]/70">{order.size_details}</td>
                <td className="px-4 py-3 text-[#1E3A5F]/70">
                  {statusLabel(order.product_type as ProductType, order.status)}
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
          {orders?.length === 0 && (
            <tr><td colSpan={8} className="px-4 py-6 text-center text-[#1E3A5F]/50">No orders yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
