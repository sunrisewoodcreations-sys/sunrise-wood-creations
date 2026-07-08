"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ProofResponse({ proofId, imageUrl }: { proofId: string; imageUrl: string }) {
  const router = useRouter();
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<"approved" | "changes_requested" | null>(null);

  async function respond(decision: "approved" | "changes_requested") {
    if (decision === "changes_requested" && !showFeedback) {
      setShowFeedback(true);
      return;
    }
    setLoading(true);
    const res = await fetch(`/api/proofs/${proofId}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, feedback })
    });
    setLoading(false);
    if (res.ok) {
      setDone(decision);
      router.refresh();
    }
  }

  if (done) {
    return (
      <div className="text-sm bg-sage/10 text-sage font-semibold p-3 rounded-md mt-3">
        {done === "approved"
          ? "Thanks! Your design is approved and moving into production."
          : "Thanks for the feedback — we'll send an updated proof soon."}
      </div>
    );
  }

  return (
    <div className="border border-dashed border-ember bg-ember/5 rounded-lg p-4 mt-4">
      <h3 className="font-semibold text-walnut text-sm mb-2">Design proof — awaiting your review</h3>
      <img src={imageUrl} alt="Your design proof" className="rounded-md border border-walnut/10 mb-3 max-w-full" />
      {!showFeedback ? (
        <div className="flex gap-2">
          <button
            onClick={() => respond("approved")}
            disabled={loading}
            className="bg-sage text-white px-4 py-2 rounded-md text-sm font-semibold"
          >
            Approve proof
          </button>
          <button
            onClick={() => respond("changes_requested")}
            disabled={loading}
            className="border border-walnut text-walnut px-4 py-2 rounded-md text-sm font-semibold"
          >
            Request changes
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <textarea
            value={feedback}
            onChange={e => setFeedback(e.target.value)}
            placeholder="Tell us what you'd like changed..."
            className="w-full border border-walnut/15 rounded-md p-2 text-sm"
            rows={3}
          />
          <button
            onClick={() => respond("changes_requested")}
            disabled={loading || !feedback.trim()}
            className="bg-ember text-white px-4 py-2 rounded-md text-sm font-semibold disabled:opacity-50"
          >
            Send feedback
          </button>
        </div>
      )}
    </div>
  );
}
