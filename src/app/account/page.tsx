import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { productLabel, statusLabel, ProductType } from "@/lib/statusSteps";

export default async function AccountPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: orders } = await supabase
    .from("orders")
    .select("*")
    .eq("customer_id", user.id)
    .order("created_at", { ascending: false });

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

  return (
    <div className="min-h-screen bg-cream flex flex-col">
      <SiteHeader />
      <div className="max-w-2xl mx-auto px-4 py-10 flex-1 w-full">
        <div className="bg-white border border-walnut/10 rounded-xl p-7">
          <h1 className="font-display text-2xl text-walnut mb-1">Your orders</h1>
          <p className="text-sm text-walnut/60 mb-5">Signed in as {user.email}</p>

          {(!orders || orders.length === 0) && (
            <p className="text-sm text-walnut/60">
              No orders yet. Once you place an order, it'll show up here.
            </p>
          )}

          {orders?.map(order => {
            const invoice = latestInvoiceByOrder[order.id];
            return (
              <div
                key={order.id}
                className="flex items-center justify-between py-4 border-b border-walnut/10 last:border-b-0 -mx-2 px-2 rounded-md"
              >
                <Link href={`/account/orders/${order.id}`} className="flex-1 hover:bg-cream/50 -m-2 p-2 rounded-md">
                  <div className="font-semibold text-walnut text-sm">
                    {productLabel(order.product_type as ProductType)} — {order.title}
                  </div>
                  <div className="text-xs text-walnut/50 font-mono">
                    Placed {new Date(order.created_at).toLocaleDateString()}
                  </div>
                </Link>
                <div className="flex items-center gap-3">
                  {invoice?.pdf_url && (
                    <a
                      href={invoice.pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs font-semibold text-ember hover:underline whitespace-nowrap"
                    >
                      Invoice #{invoice.invoice_number}
                    </a>
                  )}
                  <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-amber/20 text-walnut whitespace-nowrap">
                    {statusLabel(order.product_type as ProductType, order.status)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
