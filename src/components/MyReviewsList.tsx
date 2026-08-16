"use client";

import { useState } from "react";
import ReviewForm from "@/components/ReviewForm";

type EligibleItem = { id: string; title: string };
type ExistingReview = { id: string; rating: number; review_text: string; status: string };

export default function MyReviewsList({
  items,
  reviewsByItemId
}: {
  items: EligibleItem[];
  reviewsByItemId: Record<string, ExistingReview>;
}) {
  const [openItemId, setOpenItemId] = useState<string | null>(null);

  if (items.length === 0) {
    return (
      <div className="bg-white border border-walnut/10 rounded-xl shadow-sm p-6">
        <p className="text-sm text-walnut/60">Once you've picked up an order, you'll be able to review it here.</p>
      </div>
    );
  }

  const statusLabel: Record<string, string> = {
    pending: "Pending review by our team",
    approved: "Published",
    rejected: "Not published"
  };
  const statusColor: Record<string, string> = {
    pending: "bg-amber/20 text-amber",
    approved: "bg-sage/20 text-sage",
    rejected: "bg-walnut/10 text-walnut/50"
  };

  return (
    <div className="space-y-3">
      {items.map(item => {
        const existing = reviewsByItemId[item.id];
        const isOpen = openItemId === item.id;

        return (
          <div key={item.id} className="bg-white border border-walnut/10 rounded-xl shadow-sm p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="font-semibold text-walnut">{item.title}</div>
              {existing && (
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColor[existing.status]}`}>
                  {statusLabel[existing.status]}
                </span>
              )}
            </div>

            {existing && !isOpen ? (
              <div className="mt-2">
                <div className="text-amber text-lg leading-none mb-1">{"★".repeat(existing.rating)}{"☆".repeat(5 - existing.rating)}</div>
                <p className="text-sm text-walnut/70 mb-2">{existing.review_text}</p>
                <button onClick={() => setOpenItemId(item.id)} className="text-xs font-semibold text-ember hover:underline">
                  Edit review
                </button>
              </div>
            ) : !isOpen ? (
              <button
                onClick={() => setOpenItemId(item.id)}
                className="mt-2 text-sm font-semibold text-ember hover:underline"
              >
                Write a Review
              </button>
            ) : (
              <div className="mt-3 pt-3 border-t border-walnut/10">
                <ReviewForm
                  orderItemId={item.id}
                  initialRating={existing?.rating}
                  initialText={existing?.review_text}
                  onDone={() => setOpenItemId(null)}
                />
                <button onClick={() => setOpenItemId(null)} className="text-xs text-walnut/50 mt-2">
                  Cancel
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
