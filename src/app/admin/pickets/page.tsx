import { createClient } from "@/lib/supabase/server";
import AddPicketPurchaseForm from "@/components/AddPicketPurchaseForm";

export default async function PicketsPage() {
  const supabase = createClient();

  const { data: purchases } = await supabase
    .from("picket_purchases")
    .select("*")
    .order("purchased_at", { ascending: true })
    .order("created_at", { ascending: true });

  const totalRemaining = (purchases || []).reduce((s: number, p: any) => s + p.remaining_quantity, 0);
  const totalValueRemainingCents = (purchases || []).reduce((s: number, p: any) => s + p.remaining_quantity * p.cost_per_picket_cents, 0);

  return (
    <div>
      <h1 className="font-display text-2xl text-[#1E3A5F] mb-1">Picket inventory</h1>
      <p className="text-sm text-[#1E3A5F]/60 mb-6">
        For planter box materials only. Log each pallet as you buy it — usage gets costed oldest-pallet-first automatically.
      </p>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white border border-[#1E3A5F]/10 rounded-xl shadow-sm p-5">
          <div className="text-xs text-[#1E3A5F]/50 uppercase tracking-wide mb-1">Pickets remaining</div>
          <div className="text-2xl font-display text-[#1E3A5F]">{totalRemaining}</div>
        </div>
        <div className="bg-white border border-[#1E3A5F]/10 rounded-xl shadow-sm p-5">
          <div className="text-xs text-[#1E3A5F]/50 uppercase tracking-wide mb-1">Value of remaining stock</div>
          <div className="text-2xl font-display text-[#1E3A5F]">${(totalValueRemainingCents / 100).toFixed(2)}</div>
        </div>
      </div>

      <AddPicketPurchaseForm />

      <div className="overflow-x-auto bg-white border border-[#1E3A5F]/10 rounded-xl shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[#1E3A5F] text-white text-xs uppercase tracking-wide">
            <th className="text-left px-4 py-3">Date purchased</th>
            <th className="text-right px-4 py-3">Bought</th>
            <th className="text-right px-4 py-3">Total paid</th>
            <th className="text-right px-4 py-3">Cost per picket</th>
            <th className="text-right px-4 py-3">Remaining</th>
          </tr>
        </thead>
        <tbody>
          {purchases?.map((p: any) => (
            <tr key={p.id} className="border-t border-[#1E3A5F]/10">
              <td className="px-4 py-3 text-[#1E3A5F]/70">{new Date(p.purchased_at + "T00:00:00").toLocaleDateString()}</td>
              <td className="px-4 py-3 text-right text-[#1E3A5F]/70">{p.quantity}</td>
              <td className="px-4 py-3 text-right text-[#1E3A5F]/70">${(p.total_cost_cents / 100).toFixed(2)}</td>
              <td className="px-4 py-3 text-right text-[#1E3A5F]/70">${(p.cost_per_picket_cents / 100).toFixed(2)}</td>
              <td className={`px-4 py-3 text-right font-semibold ${p.remaining_quantity > 0 ? "text-sage" : "text-[#1E3A5F]/40"}`}>
                {p.remaining_quantity}
              </td>
            </tr>
          ))}
          {(!purchases || purchases.length === 0) && (
            <tr><td colSpan={5} className="px-4 py-6 text-center text-[#1E3A5F]/50">No purchases logged yet.</td></tr>
          )}
        </tbody>
      </table>
      </div>
    </div>
  );
}
