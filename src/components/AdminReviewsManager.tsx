"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Review = {
  id: string;
  rating: number;
  review_text: string;
  status: string;
  created_at: string;
  productTitle: string;
  orderId: string;
  customerName: string;
};

export default function AdminReviewsManager({ reviews }: { reviews: Review[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected">("pending");

  async function setStatus(id: string, status: "approved" | "rejected") {
    setBusyId(id);
    await fetch("/api/admin/reviews", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status })
    });
    setBusyId(null);
    router.refresh();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this review permanently?")) return;
    setBusyId(id);
    await fetch("/api/admin/reviews", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id })
    });
    setBusyId(null);
    router.refresh();
  }

  const filtered = reviews.filter(r => r.status === filter);
  const counts = {
    pending: reviews.filter(r => r.status === "pending").length,
    approved: reviews.filter(r => r.status === "approved").length,
    rejected: reviews.filter(r => r.status === "rejected").length
  };

  return (
    <div>
      <div className="flex gap-2 mb-5">
        {(["pending", "approved", "rejected"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-4 py-2 rounded-full text-sm font-semibold capitalize ${
              filter === tab ? "bg-[#1E3A5F] text-white" : "bg-white border border-[#1E3A5F]/15 text-[#1E3A5F]"
            }`}
          >
            {tab} ({counts[tab]})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-[#1E3A5F]/50">No {filter} reviews.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map(review => (
            <div key={review.id} className="bg-white border border-[#1E3A5F]/10 rounded-xl shadow-sm p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
                <div>
                  <div className="font-semibold text-[#1E3A5F]">{review.productTitle}</div>
                  <div className="text-xs text-[#1E3A5F]/50">
                    {review.customerName} · <a href={`/admin/orders/${review.orderId}`} className="hover:underline">View order</a>
                  </div>
                </div>
                <div className="text-amber text-base leading-none">{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</div>
              </div>
              <p className="text-sm text-[#1E3A5F]/70 mb-3">{review.review_text}</p>
              <div className="flex gap-2">
                {review.status !== "approved" && (
                  <button
                    onClick={() => setStatus(review.id, "approved")}
                    disabled={busyId === review.id}
                    className="bg-sage text-white px-3 py-1.5 rounded-md text-xs font-semibold disabled:opacity-50"
                  >
                    Approve
                  </button>
                )}
                {review.status !== "rejected" && (
                  <button
                    onClick={() => setStatus(review.id, "rejected")}
                    disabled={busyId === review.id}
                    className="border border-[#1E3A5F]/20 text-[#1E3A5F] px-3 py-1.5 rounded-md text-xs font-semibold disabled:opacity-50"
                  >
                    Reject
                  </button>
                )}
                <button
                  onClick={() => handleDelete(review.id)}
                  disabled={busyId === review.id}
                  className="text-ember text-xs font-semibold ml-auto disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
