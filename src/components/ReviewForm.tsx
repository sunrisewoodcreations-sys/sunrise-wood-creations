"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ReviewForm({
  orderItemId,
  initialRating,
  initialText,
  onDone
}: {
  orderItemId: string;
  initialRating?: number;
  initialText?: string;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [rating, setRating] = useState(initialRating || 0);
  const [hoverRating, setHoverRating] = useState(0);
  const [text, setText] = useState(initialText || "");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rating < 1) { setError("Please select a star rating."); return; }
    setStatus("loading");
    setError("");

    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderItemId, rating, reviewText: text })
    });
    const body = await res.json().catch(() => ({}));
    setStatus("idle");
    if (!res.ok) { setError(body.error || "Couldn't submit your review."); return; }

    router.refresh();
    onDone?.();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(star => (
          <button
            key={star}
            type="button"
            onClick={() => setRating(star)}
            onMouseEnter={() => setHoverRating(star)}
            onMouseLeave={() => setHoverRating(0)}
            aria-label={`${star} star${star === 1 ? "" : "s"}`}
            className="text-2xl leading-none"
          >
            <span className={(hoverRating || rating) >= star ? "text-amber" : "text-walnut/20"}>★</span>
          </button>
        ))}
      </div>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        rows={4}
        required
        placeholder="Tell others about your experience with this piece..."
        className="w-full border border-walnut/15 rounded-md px-3 py-2 text-sm"
      />
      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>}
      <button
        type="submit"
        disabled={status === "loading"}
        className="bg-ember text-white px-5 py-2.5 rounded-md text-sm font-semibold disabled:opacity-60"
      >
        {status === "loading" ? "Submitting..." : initialText ? "Update Review" : "Submit Review"}
      </button>
      <p className="text-xs text-walnut/50">Reviews are checked before appearing publicly, usually within a day or two.</p>
    </form>
  );
}
