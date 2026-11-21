"use client";

import { useState } from "react";

type Decision = "approved" | "changes_requested";

// Shows one or two design images; each design gets its own Approve /
// Request changes buttons, so a customer can approve one and send the
// other back. Single-image proofs look and behave as before.
export default function ProofDesigns({
  endpoint,
  imageUrl,
  imageUrl2,
  initial1,
  initial2,
  approveLabel = "Approve proof",
  changesLabel = "Need to change something?",
  onComplete
}: {
  endpoint: string;
  imageUrl: string;
  imageUrl2?: string | null;
  initial1?: string | null;
  initial2?: string | null;
  approveLabel?: string;
  changesLabel?: string;
  onComplete: (final: Decision) => void;
}) {
  const two = !!imageUrl2;
  const [decisions, setDecisions] = useState<Record<number, Decision | null>>({
    1: (initial1 as Decision) || null,
    2: (initial2 as Decision) || null
  });
  const [openFeedback, setOpenFeedback] = useState<number | null>(null);
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function respond(design: 1 | 2, decision: Decision) {
    if (decision === "changes_requested" && openFeedback !== design) {
      setOpenFeedback(design);
      setFeedback("");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, feedback: decision === "changes_requested" ? feedback : "", design })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || "Something went wrong. Please try again.");
      } else {
        setDecisions(d => ({ ...d, [design]: decision }));
        setOpenFeedback(null);
        setFeedback("");
        if (body.complete) onComplete(body.final);
      }
    } catch {
      setError("Couldn't reach us. Check your connection and try again.");
    }
    setLoading(false);
  }

  function renderDesign(n: 1 | 2, src: string) {
    const decision = decisions[n];
    const label = two ? `Design ${n}` : "";
    return (
      <div key={n} className={two ? "pb-5 border-b border-walnut/10 last:border-0 last:pb-0 sm:border-0 sm:pb-0" : ""}>
        {two && <p className="text-sm font-semibold text-walnut mb-2">{label}</p>}
        <img src={src} alt={two ? `Design proof ${n}` : "Your design proof"} className="rounded-md border border-walnut/10 mb-3 max-w-full" />
        {decision ? (
          <p className={`text-sm font-semibold ${decision === "approved" ? "text-sage" : "text-ember"}`}>
            {decision === "approved" ? "✓ Approved" : "✓ Changes requested — we'll send an updated proof"}
          </p>
        ) : openFeedback === n ? (
          <div className="space-y-2">
            <textarea
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
              placeholder="Tell us what you'd like changed..."
              className="w-full border border-walnut/15 rounded-md p-2 text-sm"
              rows={3}
            />
            <button
              onClick={() => respond(n, "changes_requested")}
              disabled={loading || !feedback.trim()}
              className="bg-ember text-white px-4 py-2 rounded-md text-sm font-semibold disabled:opacity-50"
            >
              Send feedback
            </button>
          </div>
        ) : (
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => respond(n, "approved")}
              disabled={loading}
              className="bg-sage text-white px-4 py-2 rounded-md text-sm font-semibold disabled:opacity-60"
            >
              {two ? `Approve design ${n}` : approveLabel}
            </button>
            <button
              onClick={() => respond(n, "changes_requested")}
              disabled={loading}
              className="border border-walnut text-walnut px-4 py-2 rounded-md text-sm font-semibold"
            >
              {two ? `Change design ${n}` : changesLabel}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={two ? "grid grid-cols-1 sm:grid-cols-2 gap-6" : ""}>
      {renderDesign(1, imageUrl)}
      {two && renderDesign(2, imageUrl2!)}
      {error && <p className="text-sm text-red-700 mt-2">{error}</p>}
    </div>
  );
}
