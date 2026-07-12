"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AddPicketPurchaseForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [quantity, setQuantity] = useState("");
  const [totalCost, setTotalCost] = useState("");
  const [purchasedAt, setPurchasedAt] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/pickets/purchases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quantity,
        totalCostCents: Math.round(Number(totalCost) * 100),
        purchasedAt
      })
    });

    setLoading(false);
    if (res.ok) {
      setQuantity(""); setTotalCost("");
      setOpen(false);
      router.refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Something went wrong.");
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="bg-[#1E3A5F] text-white px-4 py-2 rounded-md text-sm font-semibold mb-5">
        + Log a pallet purchase
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-[#1E3A5F]/10 rounded-xl p-5 mb-6 space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-semibold text-[#1E3A5F] mb-1">Date purchased</label>
          <input type="date" value={purchasedAt} onChange={e => setPurchasedAt(e.target.value)} className="w-full border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#1E3A5F] mb-1">How many pickets</label>
          <input required type="number" min="1" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="150" className="w-full border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#1E3A5F] mb-1">Total cost paid ($)</label>
          <input required value={totalCost} onChange={e => setTotalCost(e.target.value)} placeholder="220" className="w-full border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm" />
        </div>
      </div>
      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={loading} className="bg-ember text-white px-4 py-2 rounded-md text-sm font-semibold disabled:opacity-60">
          {loading ? "Saving..." : "Log purchase"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="border border-[#1E3A5F] text-[#1E3A5F] px-4 py-2 rounded-md text-sm font-semibold">
          Cancel
        </button>
      </div>
    </form>
  );
}
