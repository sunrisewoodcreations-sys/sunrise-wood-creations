"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AdminButton from "@/components/AdminButton";

export default function QuoteRow({ quote }: { quote: any }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  async function toggleResponded() {
    await fetch(`/api/quote-requests/${quote.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ responded: !quote.responded })
    });
    router.refresh();
  }

  async function handleCreateQuote() {
    setCreating(true);
    setError("");
    const res = await fetch(`/api/quote-requests/${quote.id}/create-quote`, { method: "POST" });
    const body = await res.json().catch(() => ({}));
    setCreating(false);
    if (res.ok) {
      router.push(`/admin/quotes/${body.quote.id}`);
    } else {
      setError(body.error || "Couldn't create a quote from this request.");
    }
  }

  return (
    <div className="bg-white border border-[#1E3A5F]/10 rounded-xl shadow-sm p-5">
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

      {error && <p className="text-xs text-ember mb-2">{error}</p>}

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
        {quote.converted_quote_id ? (
          <a href={`/admin/quotes/${quote.converted_quote_id}`} className="text-xs font-semibold text-sage hover:underline">
            View quote →
          </a>
        ) : (
          <AdminButton variant="secondary" size="sm" onClick={handleCreateQuote} disabled={creating}>
            {creating ? "Creating..." : "Create Quote"}
          </AdminButton>
        )}
      </div>
    </div>
  );
}
