"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SendInvoiceButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSend() {
    setLoading(true);
    setError("");
    setSent(false);
    const res = await fetch(`/api/orders/${orderId}/send-invoice`, { method: "POST" });
    setLoading(false);
    if (res.ok) {
      setSent(true);
      router.refresh();
    } else {
      setError("Couldn't send that invoice.");
    }
  }

  return (
    <div className="inline-flex items-center gap-2">
      <button
        onClick={handleSend}
        disabled={loading}
        className="border border-black text-black px-3 py-1.5 rounded-md text-xs font-semibold disabled:opacity-60"
      >
        {loading ? "Sending..." : "Send invoice"}
      </button>
      {sent && <span className="text-sage text-xs font-semibold">Sent</span>}
      {error && <span className="text-ember text-xs font-semibold">{error}</span>}
    </div>
  );
}
