import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import AccountHeader from "@/components/AccountHeader";
import ProgressTracker from "@/components/ProgressTracker";
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

  return (
    <div className="min-h-screen bg-cream">
      <AccountHeader />
      <div className="max-w-2xl mx-auto px-4 py-10">
        <Link href="/account" className="text-sm text-walnut/60 mb-4 inline-block">← Back to your orders</Link>
        <div className="bg-white border border-walnut/10 rounded-xl p-7">
          <h1 className="font-display text-2xl text-walnut mb-1">
            {productLabel(order.product_type as ProductType)} — {order.title}
          </h1>
          <p className="text-sm text-walnut/60 mb-4">{order.size_details}</p>

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
                  Download invoice #{inv.invoice_number} (PDF)
                </a>
              ))}
            </div>
          ) : (
            <p className="text-sm text-walnut/50 mb-4">No invoice yet — one will appear here once a payment is recorded.</p>
          )}

          <ProgressTracker productType={order.product_type as ProductType} currentStatus={order.status} />
          {pendingProof && (
            <ProofResponse proofId={pendingProof.id} imageUrl={pendingProof.image_url} />
          )}
        </div>
      </div>
    </div>
  );
}
