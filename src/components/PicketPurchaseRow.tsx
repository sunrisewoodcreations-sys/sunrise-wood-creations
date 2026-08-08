"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AdminButton from "@/components/AdminButton";

export default function PicketPurchaseRow({ purchase }: { purchase: any }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [purchasedAt, setPurchasedAt] = useState(purchase.purchased_at);
  const [quantity, setQuantity] = useState(String(purchase.quantity));
  const [totalCost, setTotalCost] = useState((purchase.total_cost_cents / 100).toString());

  const alreadyUsed = purchase.quantity - purchase.remaining_quantity;

  async function handleSave() {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/pickets/purchases/${purchase.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ purchasedAt, quantity, totalCostCents: Math.round((Number(totalCost) || 0) * 100) })
    });
    setLoading(false);
    if (res.ok) {
      setEditing(false);
      router.refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Couldn't save changes.");
    }
  }

  async function handleDelete() {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/pickets/purchases/${purchase.id}`, { method: "DELETE" });
    setLoading(false);
    if (res.ok) {
      router.refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Couldn't delete this entry.");
      setConfirmingDelete(false);
    }
  }

  if (editing) {
    return (
      <tr className="border-t border-[#1E3A5F]/10 bg-cream/40">
        <td className="px-4 py-3">
          <input type="date" value={purchasedAt} onChange={e => setPurchasedAt(e.target.value)} className="w-full border border-[#1E3A5F]/15 rounded-md px-2 py-1 text-sm" />
        </td>
        <td className="px-4 py-3 text-right">
          <input value={quantity} onChange={e => setQuantity(e.target.value)} className="w-20 border border-[#1E3A5F]/15 rounded-md px-2 py-1 text-sm text-right" />
        </td>
        <td className="px-4 py-3 text-right">
          <input value={totalCost} onChange={e => setTotalCost(e.target.value)} className="w-24 border border-[#1E3A5F]/15 rounded-md px-2 py-1 text-sm text-right" />
        </td>
        <td className="px-4 py-3 text-right text-[#1E3A5F]/40">—</td>
        <td className="px-4 py-3 text-right text-[#1E3A5F]/40">—</td>
        <td className="px-4 py-3 text-right whitespace-nowrap">
          <div className="flex justify-end gap-2">
            <AdminButton size="sm" onClick={handleSave} disabled={loading}>{loading ? "Saving..." : "Save"}</AdminButton>
            <AdminButton size="sm" variant="secondary" onClick={() => { setEditing(false); setError(""); }}>Cancel</AdminButton>
          </div>
          {error && <div className="text-ember text-xs mt-1">{error}</div>}
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-[#1E3A5F]/10">
      <td className="px-4 py-3 text-[#1E3A5F]/70">{new Date(purchase.purchased_at + "T00:00:00").toLocaleDateString()}</td>
      <td className="px-4 py-3 text-right text-[#1E3A5F]/70">{purchase.quantity}</td>
      <td className="px-4 py-3 text-right text-[#1E3A5F]/70">${(purchase.total_cost_cents / 100).toFixed(2)}</td>
      <td className="px-4 py-3 text-right text-[#1E3A5F]/70">${(purchase.cost_per_picket_cents / 100).toFixed(2)}</td>
      <td className={`px-4 py-3 text-right font-semibold ${purchase.remaining_quantity > 0 ? "text-sage" : "text-[#1E3A5F]/40"}`}>
        {purchase.remaining_quantity}
      </td>
      <td className="px-4 py-3 text-right whitespace-nowrap">
        {confirmingDelete ? (
          <div className="flex justify-end items-center gap-2">
            <span className="text-xs text-[#1E3A5F]/60">Delete this entry?</span>
            <AdminButton size="sm" variant="destructive" onClick={handleDelete} disabled={loading}>
              {loading ? "..." : "Confirm"}
            </AdminButton>
            <AdminButton size="sm" variant="secondary" onClick={() => setConfirmingDelete(false)}>Cancel</AdminButton>
          </div>
        ) : (
          <div className="flex justify-end gap-3">
            <button onClick={() => setEditing(true)} className="text-xs font-semibold text-[#1E3A5F] hover:underline">Edit</button>
            {alreadyUsed === 0 ? (
              <button onClick={() => setConfirmingDelete(true)} className="text-xs font-semibold text-ember hover:underline">Delete</button>
            ) : (
              <span className="text-xs text-[#1E3A5F]/30" title={`${alreadyUsed} already used from this pallet`}>Delete</span>
            )}
          </div>
        )}
        {error && !confirmingDelete && <div className="text-ember text-xs mt-1">{error}</div>}
      </td>
    </tr>
  );
}
