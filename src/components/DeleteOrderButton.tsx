"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeleteOrderButton({ orderId, orderTitle }: { orderId: string; orderTitle: string }) {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleDelete() {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/orders/${orderId}`, { method: "DELETE" });
    setLoading(false);
    if (res.ok) {
      router.push("/admin/orders");
      router.refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Couldn't delete this order.");
      setConfirming(false);
    }
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="text-xs text-ember/70 hover:text-ember underline"
      >
        Delete this order
      </button>
    );
  }

  return (
    <div className="border border-ember/30 bg-ember/5 rounded-md p-3 text-sm">
      <p className="text-black mb-2 font-semibold">
        Delete "{orderTitle}" permanently? This can't be undone.
      </p>
      {error && <p className="text-ember text-xs mb-2">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={handleDelete}
          disabled={loading}
          className="bg-ember text-white px-3 py-1.5 rounded-md text-xs font-semibold disabled:opacity-60"
        >
          {loading ? "Deleting..." : "Yes, delete it"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          disabled={loading}
          className="border border-black/20 text-black px-3 py-1.5 rounded-md text-xs font-semibold"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
