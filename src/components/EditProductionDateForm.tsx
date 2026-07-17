"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Mirrors EditDueDateForm.tsx exactly, but writes to production_date
// via the existing consolidated /api/orders/[id]/production route
// (built for the Production Schedule) instead of a new endpoint.
export default function EditProductionDateForm({ orderId, initialProductionDate }: { orderId: string; initialProductionDate: string | null }) {
  const router = useRouter();
  const [date, setDate] = useState(initialProductionDate || "");
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setSaved(false);

    const res = await fetch(`/api/orders/${orderId}/production`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productionDate: date })
    });

    setLoading(false);
    if (res.ok) {
      setSaved(true);
      router.refresh();
    }
  }

  return (
    <form onSubmit={handleSave} className="flex items-center gap-2 mb-3">
      <label className="text-xs text-[#1E3A5F]/50">Production date:</label>
      <input
        type="date"
        value={date}
        onChange={e => setDate(e.target.value)}
        className="border border-[#1E3A5F]/15 rounded-md px-2 py-1 text-sm"
      />
      <button
        type="submit"
        disabled={loading}
        className="bg-[#1E3A5F] text-white px-3 py-1 rounded-md text-xs font-semibold disabled:opacity-60"
      >
        {loading ? "Saving..." : "Save"}
      </button>
      {saved && <span className="text-sage text-xs font-semibold">Saved</span>}
    </form>
  );
}
