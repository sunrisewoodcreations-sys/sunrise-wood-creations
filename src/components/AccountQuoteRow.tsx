"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Quote = {
  id: string;
  displayNumber: string;
  status: string;
  createdAt: string;
  expirationDate: string;
  totalCents: number;
  revisionNumber: number;
  shareToken: string;
  convertedOrderId: string | null;
};
type RevisionSummary = { id: string; revisionNumber: number; status: string; displayNumber: string; shareToken: string };

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-walnut/10 text-walnut/60",
  sent: "bg-amber/20 text-amber",
  viewed: "bg-amber/40 text-white",
  accepted: "bg-sage text-white",
  declined: "bg-ember/15 text-ember"
};

// Reuses the exact same token-based accept/decline routes the public
// email link uses — no separate, authenticated-only version of this
// logic. The customer's own account already gives them the token
// (their own quote, via RLS), so the same public endpoint works here too.
export default function AccountQuoteRow({ quote, revisions }: { quote: Quote; revisions: RevisionSummary[] }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState<"accept" | "decline" | null>(null);
  const [showRevisions, setShowRevisions] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const isExpired = new Date(quote.expirationDate + "T23:59:59Z") < new Date() && !["accepted", "declined"].includes(quote.status);
  const canRespond = !isExpired && !["accepted", "declined"].includes(quote.status);

  async function handleConfirm(action: "accept" | "decline") {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/quotes/token/${quote.shareToken}/${action}`, { method: "POST" });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(body.error || "Something went wrong.");
      return;
    }
    setConfirming(null);
    if (action === "accept" && body.orderId) {
      router.push(`/account/orders/${body.orderId}`);
    } else {
      router.refresh();
    }
  }

  return (
    <div className="bg-white border border-walnut/10 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="font-semibold text-walnut">{quote.displayNumber}</div>
          <div className="text-xs text-walnut/50">
            Created {new Date(quote.createdAt).toLocaleDateString()} · Expires {new Date(quote.expirationDate + "T12:00:00Z").toLocaleDateString()}
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

      <div className="text-lg font-bold text-walnut mb-3">${(quote.totalCents / 100).toFixed(2)}</div>

      {error && <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 mb-2">{error}</p>}

      {quote.convertedOrderId && (
        <a href={`/account/orders/${quote.convertedOrderId}`} className="block text-sm font-semibold text-sage hover:underline mb-3">
          View the order this quote became →
        </a>
      )}

      {confirming && (
        <div className="bg-cream border border-walnut/20 rounded-lg p-3 mb-3">
          <p className="text-sm font-semibold text-walnut mb-2">
            {confirming === "accept" ? "Accept this quote? This will automatically create your order." : "Decline this quote?"}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => handleConfirm(confirming)}
              disabled={busy}
              className={`px-4 py-2 rounded-md text-xs font-semibold text-white ${confirming === "accept" ? "bg-sage" : "bg-walnut/60"}`}
            >
              {busy ? "Please wait..." : "Yes, confirm"}
            </button>
            <button onClick={() => setConfirming(null)} disabled={busy} className="px-4 py-2 rounded-md text-xs font-semibold border border-walnut/20 text-walnut">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3 text-xs font-semibold">
        <a href={`/quote/${quote.shareToken}`} className="text-walnut hover:underline">View</a>
        <a href={`/api/quotes/${quote.id}/pdf`} target="_blank" className="text-walnut hover:underline">Download PDF</a>
        {revisions.length > 1 && (
          <button onClick={() => setShowRevisions(s => !s)} className="text-walnut hover:underline">
            {showRevisions ? "Hide revisions" : `View revisions (${revisions.length})`}
          </button>
        )}
        {!confirming && canRespond && (
          <>
            <button onClick={() => setConfirming("accept")} className="text-sage hover:underline">Accept</button>
            <button onClick={() => setConfirming("decline")} className="text-ember hover:underline">Decline</button>
          </>
        )}
      </div>

      {showRevisions && (
        <div className="mt-3 pt-3 border-t border-walnut/10 space-y-1.5">
          {revisions.map(rev => (
            <div key={rev.id} className="flex items-center justify-between text-xs">
              <span className="text-walnut/70">Revision {rev.revisionNumber} <span className="capitalize text-walnut/40">— {rev.status}</span></span>
              <div className="flex gap-2">
                <a href={`/quote/${rev.shareToken}`} className="text-walnut hover:underline">View</a>
                <a href={`/api/quotes/${rev.id}/pdf`} target="_blank" className="text-walnut hover:underline">Download PDF</a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
