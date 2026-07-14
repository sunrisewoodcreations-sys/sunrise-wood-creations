import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { productLabel, ProductType } from "@/lib/statusSteps";
import CompactProgressTracker from "@/components/CompactProgressTracker";

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

  const { data: history } = orderIds.length > 0
    ? await supabase
        .from("order_status_history")
        .select("order_id, status, created_at")
        .in("order_id", orderIds)
        .order("created_at", { ascending: true })
    : { data: [] as any[] };

  // For each order, keep the earliest timestamp each status was reached —
  // this feeds the full step-by-step bar for in-progress orders.
  const statusTimestampsByOrder: Record<string, Record<string, string>> = {};
  (history || []).forEach((h: any) => {
    if (!statusTimestampsByOrder[h.order_id]) statusTimestampsByOrder[h.order_id] = {};
    if (!statusTimestampsByOrder[h.order_id][h.status]) {
      statusTimestampsByOrder[h.order_id][h.status] = h.created_at;
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
            const orderStatusTimestamps = statusTimestampsByOrder[order.id] || {};
            const isPickedUp = order.status === "picked_up";

            return (
              <div
                key={order.id}
                className="py-4 border-b border-walnut/10 last:border-b-0"
              >
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/account/orders/${order.id}`} className="flex-1 hover:opacity-80">
                    <div className="font-semibold text-walnut text-sm">
                      {productLabel(order.product_type as ProductType)} — {order.title}
                    </div>
                    <div className="text-xs text-walnut/50 font-mono">
                      Placed {new Date(order.created_at).toLocaleDateString()}
                    </div>
                    {order.due_date && !["ready_for_pickup", "picked_up"].includes(order.status) && (
                      <div className="text-xs mt-1">
                        <div className="text-walnut/50 uppercase tracking-wide font-semibold text-[10px]">Estimated completion date</div>
                        <div className="text-walnut font-mono font-semibold text-sm">
                          {new Date(order.due_date + "T00:00:00").toLocaleDateString()}
                        </div>
                      </div>
                    )}
                  </Link>
                  <div className="flex items-center gap-3">
                    {invoice?.pdf_url && (
                      <a
                        href={invoice.pdf_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-semibold text-ember hover:underline whitespace-nowrap"
                      >
                        Download invoice
                      </a>
                    )}
                    {isPickedUp && (
                      <div className="flex flex-col items-end">
                        <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-sage/20 text-sage whitespace-nowrap">
                          Picked up
                        </span>
                        {orderStatusTimestamps["picked_up"] && (
                          <span className="text-[10px] text-walnut/40 font-mono mt-1 whitespace-nowrap">
                            {new Date(orderStatusTimestamps["picked_up"]).toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric" })},{" "}
                            {new Date(orderStatusTimestamps["picked_up"]).toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" })} ET
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {!isPickedUp && (
                  <CompactProgressTracker
                    productType={order.product_type as ProductType}
                    currentStatus={order.status}
                    statusTimestamps={orderStatusTimestamps}
                  />
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
