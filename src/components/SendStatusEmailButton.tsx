"use client";

import { useState } from "react";

export default function SendStatusEmailButton({ orderId }: { orderId: string }) {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSend() {
    setLoading(true);
    setError("");
    setSent(false);
    const res = await fetch(`/api/orders/${orderId}/send-status-email`, { method: "POST" });
    setLoading(false);
    if (res.ok) {
      setSent(true);
    } else {
      setError("Couldn't send that email.");
    }
  }

  return (
    <div className="inline-flex items-center gap-2">
      <button
        onClick={handleSend}
        disabled={loading}
        className="border border-black text-black px-3 py-1.5 rounded-md text-xs font-semibold disabled:opacity-60"
      >
        {loading ? "Sending..." : "Send status email"}
      </button>
      {sent && <span className="text-sage text-xs font-semibold">Sent</span>}
      {error && <span className="text-ember text-xs font-semibold">{error}</span>}
    </div>
  );
}
