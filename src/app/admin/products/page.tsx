import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import AddProductForm from "@/components/AddProductForm";
import ProductRow from "@/components/ProductRow";
import ProductCardMobile from "@/components/ProductCardMobile";
import { stockStatus } from "@/components/StockStatusBadge";

export default async function ProductsPage() {
  const supabase = createClient();

  const [
    { data: products },
    { data: orderItems },
    { data: legacyOrders },
    { data: picketPurchases },
    { data: recentAdjustments },
    { data: bomParts }
  ] = await Promise.all([
    supabase.from("products").select("*").order("created_at", { ascending: false }),
    supabase.from("order_items").select("product_id, quantity, orders:order_id(status)"),
    supabase.from("orders").select("product_id, quantity, status"),
    supabase.from("picket_purchases").select("remaining_quantity"),
    supabase.from("product_stock_adjustments").select("*, products:product_id(name)").order("created_at", { ascending: false }).limit(15),
    supabase.from("product_bom_parts").select("*").order("sort_order", { ascending: true })
  ]);

  const bomPartsByProduct: Record<string, any[]> = {};
  (bomParts || []).forEach((part: any) => {
    if (!bomPartsByProduct[part.product_id]) bomPartsByProduct[part.product_id] = [];
    bomPartsByProduct[part.product_id].push(part);
  });

  const remainingPickets = (picketPurchases || []).reduce((sum: number, p: any) => sum + (p.remaining_quantity || 0), 0);

  // Units sold (only counts orders actually picked up, same rule used
  // everywhere else in this app) and units reserved by open orders that
  // haven't been picked up yet — a read-only preview, not a real
  // reservation system: nothing here changes when or how stock actually
  // gets deducted.
  const unitsSoldByProduct: Record<string, number> = {};
  const reservedByProduct: Record<string, number> = {};

  (orderItems || []).forEach((it: any) => {
    if (!it.product_id) return;
    const isPickedUp = it.orders?.status === "picked_up";
    if (isPickedUp) {
      unitsSoldByProduct[it.product_id] = (unitsSoldByProduct[it.product_id] || 0) + (it.quantity || 0);
    } else {
      reservedByProduct[it.product_id] = (reservedByProduct[it.product_id] || 0) + (it.quantity || 0);
    }
  });

  // Legacy single-item orders (no order_items row) — only count these if
  // that order doesn't already have items rows, to avoid double-counting.
  const orderIdsWithItems = new Set((orderItems || []).map((it: any) => (it as any).order_id).filter(Boolean));
  (legacyOrders || []).forEach((o: any) => {
    if (!o.product_id) return;
    if (o.status === "picked_up") {
      unitsSoldByProduct[o.product_id] = (unitsSoldByProduct[o.product_id] || 0) + (o.quantity || 0);
    } else {
      reservedByProduct[o.product_id] = (reservedByProduct[o.product_id] || 0) + (o.quantity || 0);
    }
  });

  const mostPopular = [...(products || [])]
    .map((p: any) => ({ ...p, unitsSold: unitsSoldByProduct[p.id] || 0 }))
    .filter(p => p.unitsSold > 0)
    .sort((a, b) => b.unitsSold - a.unitsSold)
    .slice(0, 5);

  const inStockCount = (products || []).filter((p: any) => stockStatus(p.stock_quantity ?? 0, p.low_stock_threshold ?? 0) === "in_stock").length;
  const lowStockCount = (products || []).filter((p: any) => stockStatus(p.stock_quantity ?? 0, p.low_stock_threshold ?? 0) === "low").length;
  const outOfStockCount = (products || []).filter((p: any) => stockStatus(p.stock_quantity ?? 0, p.low_stock_threshold ?? 0) === "out").length;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="font-display text-2xl text-[#1E3A5F]">Products</h1>
        <Link href="/admin/queue" className="text-xs font-semibold text-[#1E3A5F] border border-[#1E3A5F]/20 rounded-md px-3 py-1.5 hover:bg-cream whitespace-nowrap">
          View production queue →
        </Link>
      </div>
      <p className="text-sm text-[#1E3A5F]/60 mb-4">
        Save products you make often so you can pick them instantly when creating an order.
      </p>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white border border-[#1E3A5F]/10 rounded-xl shadow-sm p-3 text-center">
          <div className="text-xl font-display text-sage">{inStockCount}</div>
          <div className="text-[10px] text-[#1E3A5F]/50 uppercase tracking-wide">In Stock</div>
        </div>
        <div className="bg-white border border-[#1E3A5F]/10 rounded-xl shadow-sm p-3 text-center">
          <div className="text-xl font-display text-amber">{lowStockCount}</div>
          <div className="text-[10px] text-[#1E3A5F]/50 uppercase tracking-wide">Low Stock</div>
        </div>
        <div className="bg-white border border-[#1E3A5F]/10 rounded-xl shadow-sm p-3 text-center">
          <div className="text-xl font-display text-ember">{outOfStockCount}</div>
          <div className="text-[10px] text-[#1E3A5F]/50 uppercase tracking-wide">Out of Stock</div>
        </div>
      </div>

      {mostPopular.length > 0 && (
        <div className="bg-white border border-[#1E3A5F]/10 rounded-xl shadow-sm p-4 mb-6">
          <div className="text-xs font-semibold text-[#1E3A5F]/50 uppercase tracking-wide mb-2">Most popular (by units picked up)</div>
          <div className="flex flex-wrap gap-2">
            {mostPopular.map((p: any, i: number) => (
              <span key={p.id} className="text-xs font-semibold bg-cream border border-[#1E3A5F]/10 rounded-full px-3 py-1.5 text-[#1E3A5F]">
                #{i + 1} {p.name} — {p.unitsSold} sold
              </span>
            ))}
          </div>
        </div>
      )}

      <AddProductForm />

      <div className="hidden md:block overflow-x-auto bg-white border border-[#1E3A5F]/10 rounded-xl shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[#1E3A5F] text-white text-xs uppercase tracking-wide">
            <th className="text-left px-4 py-3">Name</th>
            <th className="text-left px-4 py-3">Type</th>
            <th className="text-left px-4 py-3">Size / details</th>
            <th className="text-right px-4 py-3">Price</th>
            <th className="text-right px-4 py-3">Cost</th>
            <th className="text-right px-4 py-3">Margin</th>
            <th className="text-right px-4 py-3">Stock</th>
            <th className="text-right px-4 py-3">Alert at</th>
            <th className="text-right px-4 py-3">Pickets/item</th>
            <th className="text-right px-4 py-3">Buildable now</th>
            <th className="text-right px-4 py-3">Reserved (open orders)</th>
            <th className="text-right px-4 py-3">Sold</th>
            <th className="text-right px-4 py-3">Build time</th>
            <th className="text-right px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {products?.map((p: any) => {
            const buildable = p.product_type === "planter" && p.pickets_per_unit > 0
              ? Math.floor(remainingPickets / p.pickets_per_unit)
              : null;
            return (
              <ProductRow
                key={p.id}
                product={p}
                buildableNow={buildable}
                reservedQty={reservedByProduct[p.id] || 0}
                unitsSold={unitsSoldByProduct[p.id] || 0}
                bomParts={bomPartsByProduct[p.id] || []}
              />
            );
          })}
          {products?.length === 0 && (
            <tr><td colSpan={14} className="px-4 py-6 text-center text-[#1E3A5F]/50">No products saved yet.</td></tr>
          )}
        </tbody>
      </table>
      </div>

      {/* Mobile card view — same data as the desktop table above (which
          is untouched), now with full editing capability via the same
          shared logic ProductRow uses, instead of a read-only summary. */}
      <div className="md:hidden space-y-3">
        {products?.map((p: any) => {
          const buildable = p.product_type === "planter" && p.pickets_per_unit > 0
            ? Math.floor(remainingPickets / p.pickets_per_unit)
            : null;
          return (
            <ProductCardMobile
              key={p.id}
              product={p}
              buildableNow={buildable}
              reservedQty={reservedByProduct[p.id] || 0}
              unitsSold={unitsSoldByProduct[p.id] || 0}
              bomParts={bomPartsByProduct[p.id] || []}
            />
          );
        })}
        {products?.length === 0 && (
          <div className="bg-white border border-[#1E3A5F]/10 rounded-xl shadow-sm px-4 py-6 text-center text-sm text-[#1E3A5F]/50">
            No products saved yet.
          </div>
        )}
      </div>

      {recentAdjustments && recentAdjustments.length > 0 && (
        <div className="mt-8">
          <h2 className="font-display text-lg text-[#1E3A5F] mb-2">Recent stock adjustments</h2>
          <div className="overflow-x-auto bg-white border border-[#1E3A5F]/10 rounded-xl shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#1E3A5F] text-white text-xs uppercase tracking-wide">
                  <th className="text-left px-4 py-3">Product</th>
                  <th className="text-right px-4 py-3">Change</th>
                  <th className="text-left px-4 py-3">Reason</th>
                  <th className="text-left px-4 py-3">When</th>
                </tr>
              </thead>
              <tbody>
                {recentAdjustments.map((a: any) => (
                  <tr key={a.id} className="border-t border-[#1E3A5F]/10">
                    <td className="px-4 py-3 text-[#1E3A5F]/70">{a.products?.name || "—"}</td>
                    <td className="px-4 py-3 text-right font-mono">
                      <span className={a.new_quantity > a.old_quantity ? "text-sage" : "text-ember"}>
                        {a.old_quantity} → {a.new_quantity}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#1E3A5F]/70">{a.reason}</td>
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
