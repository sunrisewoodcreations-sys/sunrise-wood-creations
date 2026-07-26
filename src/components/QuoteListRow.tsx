"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatQuoteNumberWithRevision } from "@/lib/quoteNumber";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-[#1E3A5F]/10 text-[#1E3A5F]/60",
  sent: "bg-amber/20 text-amber",
  viewed: "bg-amber/40 text-white",
  accepted: "bg-sage text-white",
  declined: "bg-ember/15 text-ember"
};

export default function QuoteListRow({ quote }: { quote: any }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const displayNumber = formatQuoteNumberWithRevision(quote.quote_year, quote.quote_number, quote.revision_number);
  const isExpired = new Date(quote.expiration_date + "T23:59:59Z") < new Date() && !["accepted", "declined"].includes(quote.status);
  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/quote/${quote.share_token}` : "";

  async function handleConvert() {
    setBusy("convert");
    setError("");
    const res = await fetch(`/api/quotes/${quote.id}/convert-to-order`, { method: "POST" });
    const body = await res.json().catch(() => ({}));
    setBusy(null);
    if (res.ok) {
      router.push(`/admin/orders/${body.order.id}`);
    } else {
      setError(body.error || "Couldn't convert this quote.");
    }
  }

  async function handleDuplicate() {
    setBusy("duplicate");
    const res = await fetch(`/api/quotes/${quote.id}/duplicate`, { method: "POST" });
    const body = await res.json().catch(() => ({}));
    setBusy(null);
    if (res.ok) router.push(`/admin/quotes/${body.quote.id}`);
    else setError(body.error || "Couldn't duplicate this quote.");
  }

  async function handleSend() {
    setBusy("send");
    setError("");
    const res = await fetch(`/api/quotes/${quote.id}/send`, { method: "POST" });
    const body = await res.json().catch(() => ({}));
    setBusy(null);
    if (res.ok) router.refresh();
    else setError(body.error || "Couldn't send this quote.");
  }

  function handleCopyLink() {
    navigator.clipboard.writeText(shareUrl);
    setBusy("copied");
    setTimeout(() => setBusy(null), 1500);
  }

  return (
    <div className="bg-white border border-[#1E3A5F]/10 rounded-xl shadow-sm p-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <Link href={`/admin/quotes/${quote.id}`} className="font-semibold text-[#1E3A5F] hover:underline">
            {displayNumber} — {quote.profiles?.full_name || "Unknown"}
          </Link>
          <div className="text-xs text-[#1E3A5F]/50">
            ${(quote.total_cents / 100).toFixed(2)} · Expires {new Date(quote.expiration_date + "T12:00:00Z").toLocaleDateString()}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isExpired ? (
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-ember/15 text-ember">Expired</span>
          ) : (
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full capitalize ${STATUS_STYLES[quote.status] || ""}`}>{quote.status}</span>
          )}
        </div>
      </div>

      {error && <p className="text-xs text-ember mb-2">{error}</p>}

      <div className="flex flex-wrap gap-3 text-xs font-semibold">
        <Link href={`/admin/quotes/${quote.id}`} className="text-[#1E3A5F] hover:underline">Edit</Link>
        <a href={`/api/quotes/${quote.id}/pdf`} target="_blank" className="text-[#1E3A5F] hover:underline">Download PDF</a>
        <button onClick={handleSend} disabled={busy === "send"} className="text-[#1E3A5F] hover:underline">
          {busy === "send" ? "Sending..." : "Email to customer"}
        </button>
        <button onClick={handleCopyLink} className="text-[#1E3A5F] hover:underline">
          {busy === "copied" ? "Copied!" : "Copy link"}
        </button>
        <button onClick={handleDuplicate} disabled={busy === "duplicate"} className="text-[#1E3A5F] hover:underline">
          {busy === "duplicate" ? "Duplicating..." : "Duplicate"}
        </button>
        {quote.converted_order_id ? (
          <Link href={`/admin/orders/${quote.converted_order_id}`} className="text-sage hover:underline">View order →</Link>
        ) : (
          <button onClick={handleConvert} disabled={busy === "convert"} className="text-sage hover:underline">
            {busy === "convert" ? "Converting..." : "Convert to Order"}
          </button>
        )}
      </div>
    </div>
  );
}
