import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import AccountHeader from "@/components/AccountHeader";
import { productLabel, statusLabel, ProductType } from "@/lib/statusSteps";

export default async function AccountPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: orders } = await supabase
    .from("orders")
    .select("*")
    .eq("customer_id", user!.id)
    .order("created_at", { ascending: false });

  return (
    <div className="min-h-screen bg-cream">
      <AccountHeader />
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="bg-white border border-walnut/10 rounded-xl p-7">
          <h1 className="font-display text-2xl text-walnut mb-1">Your orders</h1>
          <p className="text-sm text-walnut/60 mb-5">Signed in as {user!.email}</p>

          {(!orders || orders.length === 0) && (
            <p className="text-sm text-walnut/60">
              No orders yet. Once you place an order, it'll show up here.
            </p>
          )}

          {orders?.map(order => (
            <Link
              key={order.id}
              href={`/account/orders/${order.id}`}
              className="flex items-center justify-between py-4 border-b border-walnut/10 last:border-b-0 hover:bg-cream/50 -mx-2 px-2 rounded-md"
            >
              <div>
                <div className="font-semibold text-walnut text-sm">
                  {productLabel(order.product_type as ProductType)} — {order.title}
                </div>
                <div className="text-xs text-walnut/50 font-mono">
                  Placed {new Date(order.created_at).toLocaleDateString()}
                </div>
              </div>
              <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-amber/20 text-walnut">
                {statusLabel(order.product_type as ProductType, order.status)}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
