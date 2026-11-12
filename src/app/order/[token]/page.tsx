import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyOrderToken } from "@/lib/orderLink";
import { invoiceDownloadUrl } from "@/lib/invoiceNames";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import CompactProgressTracker from "@/components/CompactProgressTracker";
import PaymentSummary from "@/components/PaymentSummary";
import { formatCalendarDate } from "@/lib/dateDisplay";
import { productLabel, ProductType } from "@/lib/statusSteps";

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

// Read-only order status page opened from the "View Your Order" email button —
// no login needed. Shows the same status, payment and invoice information as
// the account page; messaging and other account actions still need a login.
export default async function PublicOrderPage({ params }: { params: { token: string } }) {
  const orderId = verifyOrderToken(decodeURIComponent(params.token));
  if (!orderId) notFound();

  const admin = createAdminClient();
  const { data: order } = await admin.from("orders").select("*").eq("id", orderId).maybeSingle();
  if (!order) notFound();

  const [{ data: history }, { data: orderItems }, { data: invoices }, { data: pendingProof }, { data: customer }] = await Promise.all([
    admin.from("order_status_history").select("status, created_at").eq("order_id", order.id).order("created_at", { ascending: true }),
    admin.from("order_items").select("*").eq("order_id", order.id).order("created_at", { ascending: true }),
    admin.from("invoices").select("*").eq("order_id", order.id).order("created_at", { ascending: false }).limit(1),
    admin.from("proofs").select("respond_token").eq("order_id", order.id).eq("status", "pending").order("sent_at", { ascending: false }).limit(1).maybeSingle(),
    admin.from("profiles").select("full_name").eq("id", order.customer_id).maybeSingle()
  ]);

  const statusTimestamps: Record<string, string> = {};
  (history || []).forEach((h: any) => { if (!statusTimestamps[h.status]) statusTimestamps[h.status] = h.created_at; });
  const isPickedUp = order.status === "picked_up";

  return (
    <div className="min-h-screen bg-cream flex flex-col">
      <SiteHeader />
      <main className="max-w-2xl mx-auto px-4 py-10 flex-1 w-full">
        <div className="bg-white border border-walnut/10 rounded-xl p-7">
          <h1 className="font-display text-2xl text-walnut mb-1">
            {productLabel(order.product_type as ProductType)} — {order.title}
          </h1>
          {isPickedUp ? (
            <span className="inline-block text-xs font-semibold px-3 py-1.5 rounded-full bg-sage/20 text-sage mb-2">
              {order.fulfillment_method === "delivery" ? "Delivered" : "Picked up"}
              {statusTimestamps["picked_up"] && (
                <> · {new Date(statusTimestamps["picked_up"]).toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric" })}</>
              )}
            </span>
          ) : (
            <CompactProgressTracker
              fulfillmentMethod={order.fulfillment_method}
              productType={order.product_type as ProductType}
              currentStatus={order.status}
              statusTimestamps={statusTimestamps}
            />
          )}
          {order.size_details && <p className="text-sm text-walnut/60 mb-4">{order.size_details}</p>}

          {order.due_date && !isPickedUp && (
            <p className="text-sm text-walnut/60 mb-4">
              Estimated {order.fulfillment_method === "delivery" ? "delivery" : "pickup"} date: {formatCalendarDate(order.due_date, "long")}
            </p>
          )}

          <PaymentSummary priceCents={order.price_cents || 0} amountPaidCents={order.amount_paid_cents || 0} />

          {orderItems && orderItems.length > 1 && (
            <div className="mb-4 border border-walnut/10 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-cream text-walnut text-xs uppercase">
                    <th className="text-left px-3 py-2">Item</th>
                    <th className="text-right px-3 py-2">Qty</th>
                    <th className="text-right px-3 py-2">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {orderItems.map((it: any) => (
                    <tr key={it.id} className="border-t border-walnut/10">
                      <td className="px-3 py-2 text-walnut/80">{it.title}</td>
                      <td className="px-3 py-2 text-right text-walnut/80">{it.quantity}</td>
                      <td className="px-3 py-2 text-right text-walnut/80">${((it.unit_price_cents * it.quantity) / 100).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {invoices && invoices.length > 0 && (
            <div className="mb-4 space-y-2">
              {invoices.map((inv: any) => (
                <a
                  key={inv.id}
                  href={invoiceDownloadUrl(inv.pdf_url, inv.invoice_year, inv.invoice_number, (customer as any)?.full_name)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block border border-walnut text-walnut px-4 py-2 rounded-md text-sm font-semibold text-center hover:bg-cream"
                >
                  Download invoice
                </a>
              ))}
            </div>
          )}

          {pendingProof?.respond_token && (
            <Link href={`/proof/${pendingProof.respond_token}`} className="block bg-ember text-white px-4 py-2.5 rounded-md text-sm font-semibold text-center mb-4">
              Review your design
            </Link>
          )}

          <p className="text-xs text-walnut/50 mt-6">
            Questions? Call or email us any time. To message us about this order here, <Link href="/login" className="underline">log in to your account</Link>.
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
