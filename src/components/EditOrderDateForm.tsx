"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function EditOrderDateForm({ orderId, initialDate }: { orderId: string; initialDate: string }) {
  const router = useRouter();
  // Convert to yyyy-mm-dd for the date input, using the date as originally stored.
  const [date, setDate] = useState(new Date(initialDate).toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSaved(false);

    const res = await fetch(`/api/orders/${orderId}/date`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ createdAt: date })
    });

    setLoading(false);
    if (res.ok) {
      setSaved(true);
      router.refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Couldn't save that date.");
    }
  }

  return (
    <form onSubmit={handleSave} className="flex items-center gap-2 mb-3">
      <label className="text-xs text-[#1E3A5F]/50">Date placed:</label>
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
      {error && <span className="text-ember text-xs font-semibold">{error}</span>}
    </form>
  );
}
