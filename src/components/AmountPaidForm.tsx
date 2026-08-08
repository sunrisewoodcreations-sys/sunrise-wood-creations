"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AmountPaidForm({
  orderId,
  priceCents,
  initialAmountPaidCents
}: {
  orderId: string;
  priceCents: number;
  initialAmountPaidCents: number;
}) {
  const [amountPaid, setAmountPaid] = useState((initialAmountPaidCents / 100).toFixed(2));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  const total = priceCents / 100;
  const paidNumber = parseFloat(amountPaid) || 0;
  const due = total - paidNumber;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSaved(false);

    const res = await fetch(`/api/orders/${orderId}/payment`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amountPaidCents: Math.round(paidNumber * 100) })
    });

    setLoading(false);
    if (res.ok) {
      setSaved(true);
      router.refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Couldn't save that.");
    }
  }

  return (
    <form onSubmit={handleSave} className="bg-cream border border-[#1E3A5F]/10 rounded-lg p-4 mt-4">
      <div className="grid grid-cols-3 gap-4 mb-3 text-sm">
        <div>
          <div className="text-[#1E3A5F]/50 text-xs mb-1">Total</div>
          <div className="font-semibold text-[#1E3A5F]">${total.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-[#1E3A5F]/50 text-xs mb-1">Amount paid</div>
          <div className="flex items-center gap-1">
            <span className="text-[#1E3A5F]/60">$</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={amountPaid}
              onChange={e => setAmountPaid(e.target.value)}
              className="w-24 border border-[#1E3A5F]/15 rounded-md px-2 py-1 text-sm"
            />
          </div>
        </div>
        <div>
          <div className="text-[#1E3A5F]/50 text-xs mb-1">Still owed</div>
          <div className={`font-semibold ${due > 0 ? "text-ember" : "text-sage"}`}>
            ${due.toFixed(2)}
          </div>
        </div>
      </div>

      {error && <p className="text-ember text-xs mb-2">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="bg-[#1E3A5F] text-white px-4 py-1.5 rounded-md text-xs font-semibold disabled:opacity-60"
      >
        {loading ? "Saving..." : "Save payment"}
      </button>
      {saved && <span className="text-sage text-xs ml-2 font-semibold">Saved</span>}
    </form>
  );
}
