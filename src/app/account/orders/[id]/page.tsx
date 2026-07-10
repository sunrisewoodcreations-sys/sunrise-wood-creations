import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import CompactProgressTracker from "@/components/CompactProgressTracker";
import ProofResponse from "@/components/ProofResponse";
import { productLabel, ProductType } from "@/lib/statusSteps";

export default async function OrderDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: order } = await supabase
    .from("orders")
    .select("*")
    .eq("id", params.id)
    .eq("customer_id", user.id)
    .single();

  if (!order) notFound();

  const { data: pendingProof } = await supabase
    .from("proofs")
    .select("*")
    .eq("order_id", order.id)
    .eq("status", "pending")
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: invoices } = await supabase
    .from("invoices")
    .select("*")
    .eq("order_id", order.id)
    .order("created_at", { ascending: false })
    .limit(1);

  const { data: history } = await supabase
    .from("order_status_history")
    .select("status, created_at")
    .eq("order_id", order.id)
    .order("created_at", { ascending: true });

  const { data: orderItems } = await supabase
    .from("order_items")
    .select("*")
    .eq("order_id", order.id)
    .order("created_at", { ascending: true });

  const statusTimestamps: Record<string, string> = {};
  (history || []).forEach((h: any) => {
    if (!statusTimestamps[h.status]) statusTimestamps[h.status] = h.created_at;
  });

  const isPickedUp = order.status === "picked_up";

  return (
    <div className="min-h-screen bg-cream flex flex-col">
      <SiteHeader />
      <div className="max-w-2xl mx-auto px-4 py-10 flex-1 w-full">
        <Link href="/account" className="text-sm text-walnut/60 mb-4 inline-block">← Back to your orders</Link>
        <div className="bg-white border border-walnut/10 rounded-xl p-7">
          <div className="mb-1">
            <h1 className="font-display text-2xl text-walnut">
              {productLabel(order.product_type as ProductType)} — {order.title}
            </h1>
          </div>
          {isPickedUp ? (
            <span className="inline-block text-xs font-semibold px-3 py-1.5 rounded-full bg-sage/20 text-sage mb-2">
              Picked up
              {statusTimestamps["picked_up"] && (
                <> · {new Date(statusTimestamps["picked_up"]).toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric" })}, {new Date(statusTimestamps["picked_up"]).toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" })} ET</>
              )}
            </span>
          ) : (
            <CompactProgressTracker
              productType={order.product_type as ProductType}
              currentStatus={order.status}
              statusTimestamps={statusTimestamps}
            />
          )}
          <p className="text-sm text-walnut/60 mb-4">{order.size_details}</p>

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

          {invoices && invoices.length > 0 ? (
            <div className="mb-4 space-y-2">
              {invoices.map((inv: any) => (
                <a
                  key={inv.id}
                  href={inv.pdf_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block border border-walnut text-walnut px-4 py-2 rounded-md text-sm font-semibold text-center hover:bg-cream"
                >
                  Download invoice
                </a>
              ))}
            </div>
          ) : (
            <p className="text-sm text-walnut/50 mb-4">No invoice yet — one will appear here once a payment is recorded.</p>
          )}

          {pendingProof && (
            <ProofResponse proofId={pendingProof.id} imageUrl={pendingProof.image_url} />
          )}
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
