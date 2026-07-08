import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ProgressTracker from "@/components/ProgressTracker";
import StatusUpdater from "@/components/StatusUpdater";
import SendProofForm from "@/components/SendProofForm";
import { productLabel, ProductType } from "@/lib/statusSteps";

export default async function AdminOrderDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: order } = await supabase
    .from("orders")
    .select("*, profiles:customer_id(id, full_name, email)")
    .eq("id", params.id)
    .single();

  if (!order) notFound();
  const customer = (order as any).profiles;

  const { data: proofs } = await supabase
    .from("proofs")
    .select("*")
    .eq("order_id", order.id)
    .order("sent_at", { ascending: false });

  return (
    <div>
      <Link href={`/admin/customers/${customer.id}`} className="text-sm text-walnut/60 mb-4 inline-block">
        ← Back to {customer.full_name}
      </Link>

      <div className="bg-white border border-walnut/10 rounded-xl p-7 mb-6">
        <h1 className="font-display text-2xl text-walnut mb-1">
          {productLabel(order.product_type as ProductType)} — {order.title}
        </h1>
        <p className="text-sm text-walnut/60 mb-1">Customer: {customer.full_name} ({customer.email})</p>
        <p className="text-sm text-walnut/60 mb-4">
          {order.size_details} · ${(order.price_cents / 100).toFixed(2)} · Placed {new Date(order.created_at).toLocaleDateString()}
        </p>

        <StatusUpdater orderId={order.id} productType={order.product_type as ProductType} currentStatus={order.status} />
        <ProgressTracker productType={order.product_type as ProductType} currentStatus={order.status} />
      </div>

      {order.product_type === "cornhole" && (
        <div className="bg-white border border-walnut/10 rounded-xl p-7">
          <SendProofForm orderId={order.id} />

          {proofs && proofs.length > 0 && (
            <div className="mt-6">
              <h3 className="font-semibold text-walnut text-sm mb-3">Proof history</h3>
              {proofs.map((p: any) => (
                <div key={p.id} className="border-t border-walnut/10 pt-3 mt-3 first:border-0 first:pt-0 first:mt-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-mono text-walnut/50">
                      Sent {new Date(p.sent_at).toLocaleDateString()}
                    </span>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                      p.status === "approved" ? "bg-sage/20 text-sage" :
                      p.status === "changes_requested" ? "bg-ember/20 text-ember" : "bg-amber/20 text-walnut"
                    }`}>
                      {p.status === "pending" ? "Awaiting response" : p.status === "approved" ? "Approved" : "Changes requested"}
                    </span>
                  </div>
                  {p.feedback && (
                    <p className="text-sm bg-cream p-3 rounded-md text-walnut/80">"{p.feedback}"</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
