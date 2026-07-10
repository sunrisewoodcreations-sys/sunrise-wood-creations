"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SendProofForm({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [imageUrl, setImageUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch(`/api/orders/${orderId}/proof`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageUrl })
    });
    setLoading(false);
    if (res.ok) {
      setSent(true);
      setImageUrl("");
      router.refresh();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="border border-dashed border-ember bg-ember/5 rounded-lg p-4">
      <h3 className="font-semibold text-[#1E3A5F] text-sm mb-2">Send a design proof</h3>
      <p className="text-xs text-[#1E3A5F]/60 mb-2">
        Paste the link to the design image (uploaded to your Supabase storage). The customer gets an email to approve or request changes.
      </p>
      <div className="flex gap-2">
        <input
          required
          value={imageUrl}
          onChange={e => setImageUrl(e.target.value)}
          placeholder="https://..."
          className="flex-1 border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-ember text-white px-4 py-2 rounded-md text-sm font-semibold disabled:opacity-60"
        >
          {loading ? "Sending..." : "Send proof"}
        </button>
      </div>
      {sent && <p className="text-xs text-sage font-semibold mt-2">Proof sent — customer notified by email.</p>}
    </form>
  );
}
