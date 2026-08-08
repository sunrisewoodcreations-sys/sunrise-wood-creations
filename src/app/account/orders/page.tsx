import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import AccountNav from "@/components/AccountNav";
import ReorderButton from "@/components/ReorderButton";
import { productLabel, statusLabel, statusColor, ProductType } from "@/lib/statusSteps";
import CompactProgressTracker from "@/components/CompactProgressTracker";
import PaymentSummary from "@/components/PaymentSummary";
import { formatCalendarDate } from "@/lib/dateDisplay";

export default async function AccountOrdersPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("full_name, email, phone").eq("id", user.id).single();

  const { data: orders } = await supabase
    .from("orders")
    .select("*")
    .eq("customer_id", user.id)
    .order("created_at", { ascending: false });

  const orderIds = (orders || []).map((o: any) => o.id);

  const { data: invoices } = orderIds.length > 0
    ? await supabase.from("invoices").select("*").in("order_id", orderIds).order("created_at", { ascending: false })
    : { data: [] as any[] };

  const latestInvoiceByOrder: Record<string, any> = {};
  (invoices || []).forEach((inv: any) => {
    if (!latestInvoiceByOrder[inv.order_id]) latestInvoiceByOrder[inv.order_id] = inv;
  });

  const { data: history } = orderIds.length > 0
    ? await supabase.from("order_status_history").select("order_id, status, created_at").in("order_id", orderIds).order("created_at", { ascending: true })
    : { data: [] as any[] };

  const statusTimestampsByOrder: Record<string, Record<string, string>> = {};
  (history || []).forEach((h: any) => {
    if (!statusTimestampsByOrder[h.order_id]) statusTimestampsByOrder[h.order_id] = {};
    if (!statusTimestampsByOrder[h.order_id][h.status]) statusTimestampsByOrder[h.order_id][h.status] = h.created_at;
  });

  return (
    <div className="min-h-screen bg-cream flex flex-col">
      <SiteHeader />
      <div className="max-w-2xl mx-auto px-4 py-10 flex-1 w-full">
        <AccountNav current="/account/orders" />
        <h1 className="font-display text-2xl text-walnut mb-1">Your orders</h1>
        <p className="text-sm text-walnut/60 mb-6">Signed in as {user.email}</p>

        {(!orders || orders.length === 0) && (
          <div className="bg-white border border-walnut/10 rounded-xl shadow-sm p-6">
            <p className="text-sm text-walnut/60">No orders yet. Once you place an order, it'll show up here.</p>
          </div>
        )}

        <div className="space-y-4">
          {orders?.map(order => {
            const invoice = latestInvoiceByOrder[order.id];
            const orderStatusTimestamps = statusTimestampsByOrder[order.id] || {};
            const isPickedUp = order.status === "picked_up";
            const showPickupDate = order.due_date && !["ready_for_pickup", "picked_up"].includes(order.status);

            return (
              <div key={order.id} className="bg-white border border-walnut/10 rounded-xl shadow-sm p-5 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <Link href={`/account/orders/${order.id}`} className="flex-1 min-w-0 hover:opacity-80 transition-opacity">
                    <div className="flex items-center flex-wrap gap-3 mb-2">
                      <div className="font-semibold text-walnut text-base">
                        {productLabel(order.product_type as ProductType)} — {order.title}
                      </div>
                      <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${statusColor(order.status)}`}>
                        {statusLabel(order.product_type as ProductType, order.status)}
                      </span>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      {showPickupDate && (
                        <div className="inline-flex items-center gap-2 bg-amber/20 border border-amber/40 rounded-md px-3 py-1.5 w-fit">
                          <span className="text-walnut/70 uppercase tracking-wide font-bold text-[11px]">Estimated pickup</span>
                          <span className="text-walnut font-mono font-bold text-sm">{formatCalendarDate(order.due_date, "long")}</span>
                        </div>
                      )}
                      <div className="text-[11px] text-walnut/40 font-mono">
                        Order placed: {new Date(order.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                      </div>
                      {isPickedUp && orderStatusTimestamps["picked_up"] && (
                        <div className="text-[11px] text-walnut/40 font-mono">
                          {new Date(orderStatusTimestamps["picked_up"]).toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric" })},{" "}
                          {new Date(orderStatusTimestamps["picked_up"]).toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" })} ET
                        </div>
                      )}
                    </div>
                  </Link>

                  <div className="flex flex-col items-start sm:items-end gap-2 flex-shrink-0">
                    {invoice?.pdf_url && (
                      <a href={invoice.pdf_url} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-ember hover:underline whitespace-nowrap">
                        Download invoice
                      </a>
                    )}
                    {isPickedUp && (
                      <ReorderButton
                        customerName={profile?.full_name || user.email || "Customer"}
                        customerEmail={profile?.email || user.email || ""}
                        customerPhone={profile?.phone || null}
                        productType={order.product_type}
                        title={order.title}
                        sizeDetails={order.size_details}
                      />
                    )}
                  </div>
                </div>

                <div className="mt-4">
                  <PaymentSummary priceCents={order.price_cents || 0} amountPaidCents={order.amount_paid_cents || 0} />
                </div>

                {!isPickedUp && (
                  <div className="mt-4 sm:mt-5">
                    <CompactProgressTracker productType={order.product_type as ProductType} currentStatus={order.status} statusTimestamps={orderStatusTimestamps} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
