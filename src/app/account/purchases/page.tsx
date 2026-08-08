import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import AccountNav from "@/components/AccountNav";
import ReorderButton from "@/components/ReorderButton";
import { productLabel, ProductType } from "@/lib/statusSteps";

export default async function AccountPurchasesPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("full_name, email, phone").eq("id", user.id).single();

  const { data: purchases } = await supabase
    .from("orders")
    .select("*")
    .eq("customer_id", user.id)
    .eq("status", "picked_up")
    .order("created_at", { ascending: false });

  return (
    <div className="min-h-screen bg-cream flex flex-col">
      <SiteHeader />
      <div className="max-w-2xl mx-auto px-4 py-10 flex-1 w-full">
        <AccountNav current="/account/purchases" />
        <h1 className="font-display text-2xl text-walnut mb-1">Previous Purchases</h1>
        <p className="text-sm text-walnut/60 mb-6">Everything you've picked up before — reorder any of it in one click.</p>

        {(!purchases || purchases.length === 0) ? (
          <div className="bg-white border border-walnut/10 rounded-xl shadow-sm p-6">
            <p className="text-sm text-walnut/60">Nothing completed yet — your finished orders will show up here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {purchases.map((order: any) => (
              <div key={order.id} className="bg-white border border-walnut/10 rounded-xl shadow-sm p-4 flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold text-walnut">{productLabel(order.product_type as ProductType)} — {order.title}</div>
                  <div className="text-xs text-walnut/50">
                    Picked up {new Date(order.created_at).toLocaleDateString()} · ${(order.price_cents / 100).toFixed(2)}
                  </div>
                </div>
                <ReorderButton
                  customerName={profile?.full_name || user.email || "Customer"}
                  customerEmail={profile?.email || user.email || ""}
                  customerPhone={profile?.phone || null}
                  productType={order.product_type}
                  title={order.title}
                  sizeDetails={order.size_details}
                />
              </div>
            ))}
          </div>
        )}
      </div>
      <SiteFooter />
    </div>
  );
}
