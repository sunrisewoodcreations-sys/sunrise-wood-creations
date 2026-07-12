"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PicketUsageForm({
  orderId,
  initialPicketsUsed,
  initialMaterialCostCents
}: {
  orderId: string;
  initialPicketsUsed: number | null;
  initialMaterialCostCents: number | null;
}) {
  const router = useRouter();
  const [picketsUsed, setPicketsUsed] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch(`/api/orders/${orderId}/picket-usage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ picketsUsed })
    });

    setLoading(false);
    if (res.ok) {
      router.refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Couldn't log that.");
    }
  }

  if (initialPicketsUsed != null) {
    return (
      <div className="bg-cream/50 border border-[#1E3A5F]/10 rounded-lg px-4 py-3 mb-4 text-sm">
        <span className="text-[#1E3A5F]/70">Pickets used: </span>
        <span className="font-semibold text-[#1E3A5F]">{initialPicketsUsed}</span>
        <span className="text-[#1E3A5F]/70"> — Material cost: </span>
        <span className="font-semibold text-[#1E3A5F]">${((initialMaterialCostCents || 0) / 100).toFixed(2)}</span>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-cream/50 border border-[#1E3A5F]/10 rounded-lg px-4 py-3 mb-4">
      <label className="block text-xs font-semibold text-[#1E3A5F] mb-1">How many pickets did this planter use?</label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min="1"
          required
          value={picketsUsed}
          onChange={e => setPicketsUsed(e.target.value)}
          className="w-24 border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-[#1E3A5F] text-white px-4 py-2 rounded-md text-sm font-semibold disabled:opacity-60"
        >
          {loading ? "Calculating..." : "Log usage & calculate cost"}
        </button>
      </div>
      {error && <p className="text-xs text-ember mt-2">{error}</p>}
      <p className="text-[10px] text-[#1E3A5F]/40 mt-2">
        This can only be entered once per order — it deducts from your picket inventory (oldest pallet first).
      </p>
    </form>
  );
}
