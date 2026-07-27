import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import AddPicketPurchaseForm from "@/components/AddPicketPurchaseForm";
import PicketPurchaseRow from "@/components/PicketPurchaseRow";
import StockStatusBadge, { stockStatus } from "@/components/StockStatusBadge";

export default async function PicketsPage() {
  const supabase = createClient();

  const [
    { data: purchases },
    { data: planterProducts },
    { data: usageAllocations }
  ] = await Promise.all([
    supabase.from("picket_purchases").select("*").order("purchased_at", { ascending: true }).order("created_at", { ascending: true }),
    supabase.from("products").select("id, name, pickets_per_unit").eq("product_type", "planter").gt("pickets_per_unit", 0),
    supabase.from("picket_usage_allocations")
      .select("id, quantity, created_at, order_id, purchase_id, orders:order_id(title, product_type), picket_purchases:purchase_id(purchased_at)")
      .order("created_at", { ascending: false })
      .limit(30)
  ]);

  const totalRemaining = (purchases || []).reduce((s: number, p: any) => s + p.remaining_quantity, 0);
  const totalValueRemainingCents = (purchases || []).reduce((s: number, p: any) => s + p.remaining_quantity * p.cost_per_picket_cents, 0);

  // Same 50-picket warning line already used on the Dashboard — reused
  // here rather than a second, different threshold, so "low" means the
  // same thing everywhere it's shown. There's no per-material
  // configurable threshold in the database (unlike products), so this
  // stays a shared constant rather than a stored setting.
  const PICKET_LOW_STOCK_THRESHOLD = 50;
  const picketStatus = stockStatus(totalRemaining, PICKET_LOW_STOCK_THRESHOLD);
  const CARD_BORDER: Record<string, string> = {
    out: "border-ember/40",
    low: "border-amber/40",
    in_stock: "border-[#1E3A5F]/10"
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="font-display text-2xl text-[#1E3A5F]">Picket inventory</h1>
        <Link href="/admin/products" className="text-xs font-semibold text-[#1E3A5F] border border-[#1E3A5F]/20 rounded-md px-3 py-1.5 hover:bg-cream whitespace-nowrap">
          View products →
        </Link>
      </div>
      <p className="text-sm text-[#1E3A5F]/60 mb-6">
        For planter box materials only. Log each pallet as you buy it — usage gets costed oldest-pallet-first automatically.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className={`bg-white border-2 rounded-xl shadow-sm p-5 ${CARD_BORDER[picketStatus]}`}>
          <div className="flex items-center justify-between mb-1">
            <div className="text-xs text-[#1E3A5F]/50 uppercase tracking-wide">Pickets remaining</div>
            <StockStatusBadge quantity={totalRemaining} threshold={PICKET_LOW_STOCK_THRESHOLD} compact />
          </div>
          <div className="text-2xl font-display text-[#1E3A5F]">{totalRemaining}</div>
        </div>
        <div className="bg-white border border-[#1E3A5F]/10 rounded-xl shadow-sm p-5">
          <div className="text-xs text-[#1E3A5F]/50 uppercase tracking-wide mb-1">Value of remaining stock</div>
          <div className="text-2xl font-display text-[#1E3A5F]">${(totalValueRemainingCents / 100).toFixed(2)}</div>
        </div>
      </div>

      {planterProducts && planterProducts.length > 0 && (
        <div className="bg-white border border-[#1E3A5F]/10 rounded-xl shadow-sm p-4 mb-6">
          <div className="text-xs font-semibold text-[#1E3A5F]/50 uppercase tracking-wide mb-2">Buildable right now, from pickets on hand</div>
          <div className="flex flex-wrap gap-2">
            {planterProducts.map((p: any) => (
              <span key={p.id} className="text-xs font-semibold bg-cream border border-[#1E3A5F]/10 rounded-full px-3 py-1.5 text-[#1E3A5F]">
                {p.name}: {Math.floor(totalRemaining / p.pickets_per_unit)}
              </span>
            ))}
          </div>
        </div>
      )}

      <AddPicketPurchaseForm />

      <div className="hidden md:block overflow-x-auto bg-white border border-[#1E3A5F]/10 rounded-xl shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[#1E3A5F] text-white text-xs uppercase tracking-wide">
            <th className="text-left px-4 py-3">Date purchased</th>
            <th className="text-right px-4 py-3">Bought</th>
            <th className="text-right px-4 py-3">Total paid</th>
            <th className="text-right px-4 py-3">Cost per picket</th>
            <th className="text-right px-4 py-3">Remaining</th>
            <th className="text-right px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {purchases?.map((p: any) => (
            <PicketPurchaseRow key={p.id} purchase={p} />
          ))}
          {(!purchases || purchases.length === 0) && (
            <tr><td colSpan={6} className="px-4 py-6 text-center text-[#1E3A5F]/50">No purchases logged yet.</td></tr>
          )}
        </tbody>
      </table>
      </div>

      {/* Mobile card view — same purchase data, edit/delete still work
          via the same PicketPurchaseRow logic (rendered as a table row
          hidden on mobile isn't practical here, so mobile shows a
          simplified read display; edit/delete stays available on desktop). */}
      <div className="md:hidden space-y-3">
        {purchases?.map((p: any) => (
          <div key={p.id} className="bg-white border border-[#1E3A5F]/10 rounded-xl shadow-sm p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold text-[#1E3A5F]">{new Date(p.purchased_at + "T00:00:00").toLocaleDateString()}</div>
              <span className={`text-sm font-bold px-2 py-1 rounded-full ${p.remaining_quantity > 0 ? "bg-sage/15 text-sage" : "bg-[#1E3A5F]/5 text-[#1E3A5F]/40"}`}>
                {p.remaining_quantity} left
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div>
                <div className="text-[10px] text-[#1E3A5F]/50 uppercase font-semibold">Bought</div>
                <div className="text-[#1E3A5F]/70">{p.quantity}</div>
              </div>
              <div>
                <div className="text-[10px] text-[#1E3A5F]/50 uppercase font-semibold">Total paid</div>
                <div className="text-[#1E3A5F]/70">${(p.total_cost_cents / 100).toFixed(2)}</div>
              </div>
              <div>
                <div className="text-[10px] text-[#1E3A5F]/50 uppercase font-semibold">Per picket</div>
                <div className="text-[#1E3A5F]/70">${(p.cost_per_picket_cents / 100).toFixed(2)}</div>
              </div>
            </div>
            <p className="text-[11px] text-[#1E3A5F]/40 mt-3">To edit or delete a purchase, use a desktop screen.</p>
          </div>
        ))}
        {(!purchases || purchases.length === 0) && (
          <div className="bg-white border border-[#1E3A5F]/10 rounded-xl shadow-sm px-4 py-6 text-center text-sm text-[#1E3A5F]/50">
            No purchases logged yet.
          </div>
        )}
      </div>

      {usageAllocations && usageAllocations.length > 0 && (
        <div className="mt-8">
          <h2 className="font-display text-lg text-[#1E3A5F] mb-2">Material usage history</h2>
          <p className="text-xs text-[#1E3A5F]/50 mb-3">Every time pickets were drawn from a pallet, and which order it went to.</p>
          <div className="overflow-x-auto bg-white border border-[#1E3A5F]/10 rounded-xl shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#1E3A5F] text-white text-xs uppercase tracking-wide">
                  <th className="text-left px-4 py-3">Order</th>
                  <th className="text-right px-4 py-3">Pickets used</th>
                  <th className="text-left px-4 py-3">From pallet purchased</th>
                  <th className="text-left px-4 py-3">When</th>
                </tr>
              </thead>
              <tbody>
                {usageAllocations.map((a: any) => (
                  <tr key={a.id} className="border-t border-[#1E3A5F]/10">
                    <td className="px-4 py-3">
                      <Link href={`/admin/orders/${a.order_id}`} className="font-semibold text-[#1E3A5F] hover:underline">
                        {a.orders?.title || "Deleted order"}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right text-[#1E3A5F]/70">{a.quantity}</td>
                    <td className="px-4 py-3 text-[#1E3A5F]/70">
                      {a.picket_purchases?.purchased_at ? new Date(a.picket_purchases.purchased_at + "T00:00:00").toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-3 text-[#1E3A5F]/50 text-xs font-mono">{new Date(a.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
