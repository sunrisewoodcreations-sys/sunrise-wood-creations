"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type QuoteItem = { title: string; description: string | null; quantity: number; unitPriceCents: number };

export default function PublicQuoteView({
  token,
  quoteId,
  displayNumber,
  customerName,
  status,
  isExpired,
  expirationDate,
  revisionNumber,
  convertedOrderId,
  items,
  subtotalCents,
  discountCents,
  taxCents,
  deliveryCents,
  totalCents,
  initialAction
}: {
  token: string;
  quoteId: string;
  displayNumber: string;
  customerName: string;
  status: string;
  isExpired: boolean;
  expirationDate: string;
  revisionNumber: number;
  convertedOrderId: string | null;
  items: QuoteItem[];
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  deliveryCents: number;
  totalCents: number;
  initialAction: "accept" | "decline" | null;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState<"accept" | "decline" | null>(initialAction);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ type: "accepted"; orderId: string } | { type: "declined" } | null>(null);

  const isFinal = ["accepted", "declined"].includes(status) || result != null;
  const canRespond = !isExpired && !isFinal;

  async function handleConfirm(action: "accept" | "decline") {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/quotes/token/${token}/${action}`, { method: "POST" });
    const body = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      setError(body.error || "Something went wrong. Please try again or contact us directly.");
      return;
    }

    setConfirming(null);
    if (action === "accept") {
      setResult({ type: "accepted", orderId: body.orderId });
    } else {
      setResult({ type: "declined" });
    }
  }

  const expirationDisplay = new Date(expirationDate + "T12:00:00Z").toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="bg-white border border-walnut/10 rounded-xl p-8">
        <div className="flex items-center justify-between mb-1">
          <h1 className="font-display text-2xl text-walnut">Quote {displayNumber}</h1>
          {isExpired ? (
            <span className="text-xs font-bold bg-ember/15 text-ember px-3 py-1 rounded-full">Expired</span>
          ) : (
            <span className="text-xs font-bold bg-sage/15 text-sage px-3 py-1 rounded-full capitalize">
              {result?.type === "accepted" ? "accepted" : result?.type === "declined" ? "declined" : status}
            </span>
          )}
        </div>
        <p className="text-sm text-walnut/60 mb-2">Prepared for {customerName}</p>
        {revisionNumber > 1 && (
          <p className="text-sm font-semibold text-ember mb-4">
            This is Revision {revisionNumber} — please disregard any earlier version of this quote.
          </p>
        )}

        {isExpired && !result && (
          <div className="bg-ember/10 border border-ember/30 rounded-lg p-4 mb-6">
            <p className="text-sm font-semibold text-walnut mb-1">This quote has expired</p>
            <p className="text-sm text-walnut/70">
              It was valid through {expirationDisplay}. Wood prices change often, so we're not able to honor pricing
              past a quote's expiration date. Reach out to us and we'll be glad to put together an updated quote.
            </p>
          </div>
        )}

        <div className="space-y-2 mb-6">
          {items.map((it, i) => (
            <div key={i} className="flex justify-between border-b border-walnut/5 pb-2">
              <div>
                <div className="font-semibold text-walnut">{it.title}</div>
                {it.description && <div className="text-xs text-walnut/50">{it.description}</div>}
                <div className="text-xs text-walnut/50">Qty {it.quantity} × ${(it.unitPriceCents / 100).toFixed(2)}</div>
              </div>
              <div className="font-semibold text-walnut">${((it.unitPriceCents * it.quantity) / 100).toFixed(2)}</div>
            </div>
          ))}
        </div>

        <div className="space-y-1 text-sm mb-6">
          <div className="flex justify-between text-walnut/70"><span>Subtotal</span><span>${(subtotalCents / 100).toFixed(2)}</span></div>
          {discountCents > 0 && <div className="flex justify-between text-ember"><span>Discount</span><span>-${(discountCents / 100).toFixed(2)}</span></div>}
          <div className="flex justify-between text-walnut/70"><span>Tax</span><span>${(taxCents / 100).toFixed(2)}</span></div>
          {deliveryCents > 0 && <div className="flex justify-between text-walnut/70"><span>Delivery</span><span>${(deliveryCents / 100).toFixed(2)}</span></div>}
          <div className="flex justify-between text-lg font-bold text-walnut pt-2 border-t border-walnut/10">
            <span>Total</span><span>${(totalCents / 100).toFixed(2)}</span>
          </div>
        </div>

        {!isExpired && !isFinal && (
          <p className="text-xs text-walnut/50 mb-4">Valid through {expirationDisplay}.</p>
        )}

        {result?.type === "accepted" && (
          <div className="bg-sage/10 border border-sage/30 rounded-lg p-4 mb-4">
            <p className="text-sm font-semibold text-walnut mb-2">Thank you! Your order has been created.</p>
            <a href={`/account/orders/${result.orderId}`} className="inline-block bg-walnut text-cream px-5 py-2.5 rounded-md text-sm font-semibold">
              View your order
            </a>
            <p className="text-xs text-walnut/50 mt-2">If you're not already logged in, you'll be asked to log in first.</p>
          </div>
        )}
        {result?.type === "declined" && (
          <div className="bg-walnut/5 border border-walnut/10 rounded-lg p-4 mb-4">
            <p className="text-sm text-walnut/70">This quote has been marked as declined. Reach out anytime if you'd like to revisit it.</p>
          </div>
        )}

        {status === "accepted" && convertedOrderId && !result && (
          <div className="bg-sage/10 border border-sage/30 rounded-lg p-4 mb-4">
            <p className="text-sm font-semibold text-walnut mb-2">This quote was accepted and converted into an order.</p>
            <a href={`/account/orders/${convertedOrderId}`} className="inline-block bg-walnut text-cream px-5 py-2.5 rounded-md text-sm font-semibold">
              View your order
            </a>
          </div>
        )}
        {status === "declined" && !result && (
          <div className="bg-walnut/5 border border-walnut/10 rounded-lg p-4 mb-4">
            <p className="text-sm text-walnut/70">This quote was declined.</p>
          </div>
        )}

        {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 mb-4">{error}</p>}

        {confirming && canRespond && (
          <div className="bg-cream border border-walnut/20 rounded-lg p-4 mb-4">
            <p className="text-sm font-semibold text-walnut mb-3">
              {confirming === "accept"
                ? "Accept this quote? This will automatically create your order."
                : "Decline this quote? You can always request a new one later."}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => handleConfirm(confirming)}
                disabled={busy}
                className={`px-5 py-2.5 rounded-md text-sm font-semibold text-white ${confirming === "accept" ? "bg-sage" : "bg-walnut/60"}`}
              >
                {busy ? "Please wait..." : confirming === "accept" ? "Yes, accept quote" : "Yes, decline quote"}
              </button>
              <button onClick={() => setConfirming(null)} disabled={busy} className="px-5 py-2.5 rounded-md text-sm font-semibold border border-walnut/20 text-walnut">
                Cancel
              </button>
            </div>
          </div>
        )}

        {canRespond && !confirming && (
          <div className="flex flex-wrap gap-3 mb-4">
            <button onClick={() => setConfirming("accept")} className="bg-sage text-white px-5 py-2.5 rounded-md text-sm font-semibold">
              Accept Quote
            </button>
            <button onClick={() => setConfirming("decline")} className="border border-walnut/20 text-walnut px-5 py-2.5 rounded-md text-sm font-semibold">
              Decline Quote
            </button>
          </div>
        )}

        <a
          href={`/api/quotes/${quoteId}/pdf`}
          target="_blank"
          className="inline-block border border-walnut/20 text-walnut px-5 py-2.5 rounded-md text-sm font-semibold"
        >
          Download PDF
        </a>
      </div>
    </div>
  );
}
