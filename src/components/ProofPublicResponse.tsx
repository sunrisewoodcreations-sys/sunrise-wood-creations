"use client";

import { useState } from "react";
import Link from "next/link";

export default function ProofPublicResponse({ token, imageUrl }: { token: string; imageUrl: string }) {
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<"approved" | "changes_requested" | null>(null);
  const [error, setError] = useState("");

  async function respond(decision: "approved" | "changes_requested") {
    if (decision === "changes_requested" && !showFeedback) {
      setShowFeedback(true);
      return;
    }
    setLoading(true);
    setError("");
    const res = await fetch(`/api/proofs/token/${token}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, feedback })
    });
    setLoading(false);
    if (res.ok) {
      setDone(decision);
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Something went wrong. Please try again.");
    }
  }

  if (done === "approved") {
    return (
      <div className="text-center py-4">
        <div className="w-14 h-14 rounded-full bg-sage/15 text-sage flex items-center justify-center mx-auto mb-4 text-2xl">
          ✓
        </div>
        <h2 className="font-display text-xl text-walnut mb-2">Thanks for approving!</h2>
        <p className="text-sm text-walnut/70 mb-6">
          We'll notify you at every step of the way as your order moves through production.
        </p>
        <Link
          href="/"
          className="inline-block bg-walnut text-cream px-6 py-2.5 rounded-md text-sm font-semibold"
        >
