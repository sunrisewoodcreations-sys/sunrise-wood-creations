import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ProgressTracker from "@/components/ProgressTracker";
import StatusUpdater from "@/components/StatusUpdater";
import SendProofForm from "@/components/SendProofForm";
import DeleteOrderButton from "@/components/DeleteOrderButton";
import AmountPaidForm from "@/components/AmountPaidForm";
import EditOrderDateForm from "@/components/EditOrderDateForm";
import EditDueDateForm from "@/components/EditDueDateForm";
import { formatCalendarDate } from "@/lib/dateDisplay";
import SendStatusEmailButton from "@/components/SendStatusEmailButton";
import SendInvoiceButton from "@/components/SendInvoiceButton";
import OrderChat from "@/components/OrderChat";
import PicketUsageItemForm from "@/components/PicketUsageItemForm";
import PicketUsageForm from "@/components/PicketUsageForm";
import OrderTimeline from "@/components/OrderTimeline";
import { getOrderTimeline } from "@/lib/orderTimeline";
import { productLabel, ProductType } from "@/lib/statusSteps";

export default async function AdminOrderDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: order } = await supabase
    .from("orders")
    .select("*, profiles:customer_id(id, full_name, email)")
    .eq("id", params.id)
    .single();

  if (!order) notFound();
  const customer = (order as any).profiles;
  const timelineEvents = await getOrderTimeline(order.id);

  const { data: proofs } = await supabase
    .from("proofs")
    .select("*")
    .eq("order_id", order.id)
    .order("sent_at", { ascending: false });

  const { data: history } = await supabase
    .from("order_status_history")
    .select("status, created_at")
    .eq("order_id", order.id)
    .order("created_at", { ascending: true });

  const { data: invoices } = await supabase
    .from("invoices")
    .select("*")
    .eq("order_id", order.id)
    .order("created_at", { ascending: false });

  const { data: orderItems } = await supabase
    .from("order_items")
    .select("*")
    .eq("order_id", order.id)
    .order("created_at", { ascending: true });

  // Keep the earliest time each status was reached, in case a status
  // ever gets logged more than once.
  const statusTimestamps: Record<string, string> = {};
  (history || []).forEach((h: any) => {
    if (!statusTimestamps[h.status]) {
      statusTimestamps[h.status] = h.created_at;
    }
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <Link href={`/admin/customers/${customer.id}`} className="text-sm text-[#1E3A5F]/60 inline-block">
          ← Back to {customer.full_name}
        </Link>
        <DeleteOrderButton orderId={order.id} orderTitle={order.title} />
      </div>

      <div className="bg-white border border-[#1E3A5F]/10 rounded-xl p-7 mb-6">
        <h1 className="font-display text-2xl text-[#1E3A5F] mb-1">
          {productLabel(order.product_type as ProductType)} — {order.title}
        </h1>
        <p className="text-sm text-[#1E3A5F]/60 mb-1">Customer: {customer.full_name} ({customer.email})</p>
        <EditOrderDateForm orderId={order.id} initialDate={order.created_at} />
        <EditDueDateForm orderId={order.id} initialDueDate={order.due_date} />
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs text-[#1E3A5F]/50">Production date:</span>
          <span className="text-sm font-semibold text-[#1E3A5F]">
            {order.production_date ? formatCalendarDate(order.production_date) : "—"}
          </span>
          <span className="text-xs text-[#1E3A5F]/40 italic">
            {["ready_for_pickup", "completed"].includes(order.production_status)
              ? "(locked — already ready/complete)"
              : "(auto-set to 1 day before pickup)"}
          </span>
        </div>
        <p className="text-sm text-[#1E3A5F]/60 mb-4">
          {order.size_details} · ${(order.price_cents / 100).toFixed(2)} · Placed {new Date(order.created_at).toLocaleDateString()}
        </p>

        {orderItems && orderItems.length > 0 ? (
          orderItems.map((it: any) => (
            it.product_type === "planter" && (
              <PicketUsageItemForm
                key={it.id}
                orderItemId={it.id}
                itemTitle={it.title}
                initialPicketsUsed={it.pickets_used}
                initialMaterialCostCents={it.material_cost_cents}
              />
            )
          ))
        ) : (
          order.product_type === "planter" && (
            <PicketUsageForm
              orderId={order.id}
              initialPicketsUsed={order.pickets_used}
              initialMaterialCostCents={order.material_cost_cents}
            />
          )
        )}

        {orderItems && orderItems.length > 1 && (
          <div className="mb-4 border border-[#1E3A5F]/10 rounded-lg overflow-x-auto overflow-y-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#1E3A5F] text-white text-xs uppercase tracking-wide">
                  <th className="text-left px-3 py-2">Item</th>
                  <th className="text-left px-3 py-2">Size / details</th>
                  <th className="text-right px-3 py-2">Qty</th>
                  <th className="text-right px-3 py-2">Price</th>
                </tr>
              </thead>
              <tbody>
                {orderItems.map((it: any) => (
                  <tr key={it.id} className="border-t border-[#1E3A5F]/10">
                    <td className="px-3 py-2 text-[#1E3A5F]/70">{it.title}</td>
                    <td className="px-3 py-2 text-[#1E3A5F]/70">{it.size_details || "—"}</td>
                    <td className="px-3 py-2 text-right text-[#1E3A5F]/70">{it.quantity}</td>
                    <td className="px-3 py-2 text-right text-[#1E3A5F]/70">${((it.unit_price_cents * it.quantity) / 100).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <AmountPaidForm
          orderId={order.id}
          priceCents={order.price_cents}
          initialAmountPaidCents={order.amount_paid_cents || 0}
        />

        <div className="flex gap-2 mb-4">
          <SendStatusEmailButton orderId={order.id} />
          <SendInvoiceButton orderId={order.id} />
        </div>

        <StatusUpdater orderId={order.id} productType={order.product_type as ProductType} currentStatus={order.status} />
        <ProgressTracker productType={order.product_type as ProductType} currentStatus={order.status} statusTimestamps={statusTimestamps} />
      </div>

      {order.product_type === "cornhole" && (
        <div className="bg-white border border-[#1E3A5F]/10 rounded-xl p-7">
          <SendProofForm orderId={order.id} />

          {proofs && proofs.length > 0 && (
            <div className="mt-6">
              <h3 className="font-semibold text-[#1E3A5F] text-sm mb-3">Proof history</h3>
              {proofs.map((p: any) => (
                <div key={p.id} className="border-t border-[#1E3A5F]/10 pt-3 mt-3 first:border-0 first:pt-0 first:mt-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-mono text-[#1E3A5F]/50">
                      Sent {new Date(p.sent_at).toLocaleDateString("en-US", { timeZone: "America/New_York" })} at{" "}
                      {new Date(p.sent_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" })} ET
                    </span>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                      p.status === "approved" ? "bg-sage/20 text-sage" :
                      p.status === "changes_requested" ? "bg-ember/20 text-ember" : "bg-amber/20 text-[#1E3A5F]"
                    }`}>
                      {p.status === "pending" ? "Awaiting response" : p.status === "approved" ? "Approved" : "Changes requested"}
                    </span>
                  </div>
                  {p.responded_at && (
                    <div className="text-xs font-mono text-[#1E3A5F]/50 mb-1">
                      {p.status === "approved" ? "Approved" : "Responded"}{" "}
                      {new Date(p.responded_at).toLocaleDateString("en-US", { timeZone: "America/New_York" })} at{" "}
                      {new Date(p.responded_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" })} ET
                    </div>
                  )}
                  {p.feedback && (
                    <p className="text-sm bg-cream p-3 rounded-md text-[#1E3A5F]/80">"{p.feedback}"</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {invoices && invoices.length > 0 && (
        <div className="bg-white border border-[#1E3A5F]/10 rounded-xl p-7 mt-6">
          <h3 className="font-semibold text-[#1E3A5F] text-sm mb-3">Invoices sent to customer</h3>
          {invoices.map((inv: any) => (
            <div key={inv.id} className="flex items-center justify-between border-t border-[#1E3A5F]/10 pt-3 mt-3 first:border-0 first:pt-0 first:mt-0">
              <div>
                <div className="text-sm font-semibold text-[#1E3A5F]">Invoice #{inv.invoice_number}</div>
                <div className="text-xs font-mono text-[#1E3A5F]/50">
                  {inv.sent_at
                    ? `Emailed ${new Date(inv.sent_at).toLocaleDateString("en-US", { timeZone: "America/New_York" })} at ${new Date(inv.sent_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" })} ET`
                    : "Not yet emailed"}
                </div>
              </div>
              {inv.pdf_url ? (
                <a
                  href={inv.pdf_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold text-ember hover:underline"
                >
                  Download PDF
                </a>
              ) : (
                <span className="text-xs text-[#1E3A5F]/40">Unavailable</span>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-6">
        <OrderChat orderId={order.id} currentUserId={user!.id} isAdmin />
      </div>

      <div className="mt-6">
        <OrderTimeline events={timelineEvents} />
      </div>
    </div>
  );
}
