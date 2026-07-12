"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const PRODUCT_TYPES = [
  { value: "cornhole", label: "Cornhole boards" },
  { value: "sign", label: "Wooden sign" },
  { value: "planter", label: "Planter box" },
  { value: "cutting_board", label: "Cutting board" }
];

export default function QuoteRow({ quote }: { quote: any }) {
  const router = useRouter();
  const [converting, setConverting] = useState(false);
  const [price, setPrice] = useState("");
  const [productType, setProductType] = useState(quote.product_type || "sign");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function toggleResponded() {
    await fetch(`/api/quote-requests/${quote.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ responded: !quote.responded })
    });
    router.refresh();
  }

  async function handleConvert(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch(`/api/quote-requests/${quote.id}/convert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priceCents: Math.round((Number(price) || 0) * 100), productType })
    });

    const body = await res.json().catch(() => ({}));
    setLoading(false);

    if (res.ok) {
      router.push(`/admin/orders/${body.orderId}`);
    } else {
      setError(body.error || "Couldn't convert this quote.");
    }
  }

  return (
    <div className="bg-white border border-[#1E3A5F]/10 rounded-xl p-5">
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold text-[#1E3A5F]">
          {quote.name} <span className="font-normal text-[#1E3A5F]/50">({quote.email})</span>
        </div>
        <div className="text-xs font-mono text-[#1E3A5F]/40">
          {new Date(quote.created_at).toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric" })}
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-[#1E3A5F]/60 mb-3">
        {quote.phone && <div><strong>Phone:</strong> {quote.phone}</div>}
        {quote.product_type && <div><strong>Type:</strong> {quote.product_type}</div>}
        {quote.dimensions && <div><strong>Size:</strong> {quote.dimensions}</div>}
        {quote.wood_type && <div><strong>Wood:</strong> {quote.wood_type}</div>}
        {quote.budget && <div><strong>Budget:</strong> {quote.budget}</div>}
        {quote.timeline && <div><strong>Timeline:</strong> {quote.timeline}</div>}
      </div>
      <p className="text-sm text-[#1E3A5F]/80 mb-3">{quote.description}</p>

      <div className="flex items-center gap-4 flex-wrap">
        <a
          href={`mailto:${quote.email}?subject=${encodeURIComponent("Re: your custom quote request")}`}
          className="text-xs font-semibold text-ember hover:underline"
        >
          Reply by email
        </a>
        <button onClick={toggleResponded} className="text-xs font-semibold text-[#1E3A5F] hover:underline">
          {quote.responded ? "Mark as unresponded" : "Mark as responded"}
        </button>
        {quote.responded && (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-sage/20 text-sage">Responded</span>
        )}
        {quote.converted_order_id ? (
          <a href={`/admin/orders/${quote.converted_order_id}`} className="text-xs font-semibold text-sage hover:underline">
            View converted order →
          </a>
        ) : (
          !converting && (
            <button onClick={() => setConverting(true)} className="text-xs font-semibold text-[#1E3A5F] border border-[#1E3A5F]/20 rounded-md px-2 py-1 hover:bg-cream">
              Convert to order
            </button>
          )
        )}
      </div>

      {converting && !quote.converted_order_id && (
        <form onSubmit={handleConvert} className="mt-3 pt-3 border-t border-[#1E3A5F]/10 flex items-end gap-2 flex-wrap">
          <div>
            <label className="block text-[11px] font-semibold text-[#1E3A5F] mb-1">Product type</label>
            <select value={productType} onChange={e => setProductType(e.target.value)} className="border border-[#1E3A5F]/15 rounded-md px-2 py-1.5 text-sm">
              {PRODUCT_TYPES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#1E3A5F] mb-1">Price ($)</label>
            <input required value={price} onChange={e => setPrice(e.target.value)} placeholder="150" className="w-24 border border-[#1E3A5F]/15 rounded-md px-2 py-1.5 text-sm" />
          </div>
          <button type="submit" disabled={loading} className="bg-ember text-white px-4 py-1.5 rounded-md text-sm font-semibold disabled:opacity-60">
            {loading ? "Creating..." : "Create order"}
          </button>
          <button type="button" onClick={() => setConverting(false)} className="text-xs text-[#1E3A5F]/50 underline">Cancel</button>
          {error && <p className="text-xs text-ember w-full">{error}</p>}
        </form>
      )}
    </div>
  );
}
