"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { reviewDateDisplay, reviewDateInputValue } from "@/lib/manualReviews";

type Review = {
  id: string;
  rating: number;
  review_text: string;
  status: string;
  created_at: string;
  source: string;
  productTitle: string;
  orderId: string;
  customerName: string;
};

const inputCls = "w-full border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm bg-white";

function todayInput(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function Stars({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex gap-1" role="radiogroup" aria-label="Stars">
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button" onClick={() => onChange(n)} aria-label={`${n} star${n > 1 ? "s" : ""}`}
          className={`text-2xl leading-none ${n <= value ? "text-amber" : "text-[#1E3A5F]/20"}`}>★</button>
      ))}
    </div>
  );
}

// Add a review by hand (copied from Facebook) — shown on the site right away.
function AddFacebookReview({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  const [productLabel, setProductLabel] = useState("");
  const [date, setDate] = useState(todayInput());
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    const res = await fetch("/api/admin/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, rating, text, productLabel, date })
    });
    setLoading(false);
    if (!res.ok) { setError((await res.json().catch(() => ({}))).error || "Couldn't save that review."); return; }
    setName(""); setText(""); setProductLabel(""); setRating(5); setDate(todayInput()); setOpen(false);
    onDone();
  }

  if (!open) {
    return <button type="button" onClick={() => setOpen(true)} className="mb-5 bg-[#1E3A5F] text-white px-4 py-2 rounded-md text-sm font-semibold">+ Add a Facebook review</button>;
  }
  return (
    <form onSubmit={save} className="mb-6 bg-cream border border-[#1E3A5F]/10 rounded-xl p-4 space-y-3 max-w-xl">
      <div className="font-semibold text-[#1E3A5F] text-sm">Add a review from Facebook</div>
      <div>
        <label className="block text-xs text-[#1E3A5F]/50 mb-1">Reviewer's name</label>
        <input className={inputCls} value={name} onChange={e => setName(e.target.value)} maxLength={80} placeholder="Only the first name shows on the site" />
      </div>
      <div>
        <label className="block text-xs text-[#1E3A5F]/50 mb-1">Stars</label>
        <Stars value={rating} onChange={setRating} />
      </div>
      <div>
        <label className="block text-xs text-[#1E3A5F]/50 mb-1">Review</label>
        <textarea className={inputCls} rows={4} value={text} onChange={e => setText(e.target.value)} maxLength={2000} placeholder="Paste the review text" />
      </div>
      <div>
        <label className="block text-xs text-[#1E3A5F]/50 mb-1">What they bought (optional)</label>
        <input className={inputCls} value={productLabel} onChange={e => setProductLabel(e.target.value)} maxLength={100} placeholder="e.g. Cornhole boards" />
      </div>
      <div>
        <label className="block text-xs text-[#1E3A5F]/50 mb-1">Date of the review</label>
        <input type="date" className={inputCls} value={date} max={todayInput()} onChange={e => setDate(e.target.value)} />
      </div>
      {error && <p className="text-ember text-xs">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={loading} className="bg-sage text-white px-4 py-2 rounded-md text-sm font-semibold disabled:opacity-60">{loading ? "Saving..." : "Add review"}</button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-[#1E3A5F]/60 px-2">Cancel</button>
      </div>
    </form>
  );
}

function EditReview({ review, onDone, onCancel }: { review: Review; onDone: () => void; onCancel: () => void }) {
  const isFb = review.source === "facebook";
  const [date, setDate] = useState(reviewDateInputValue(review.created_at));
  const [name, setName] = useState(review.customerName);
  const [rating, setRating] = useState(review.rating);
  const [text, setText] = useState(review.review_text);
  const [productLabel, setProductLabel] = useState(review.productTitle);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    const body: any = { id: review.id, date };
    if (isFb) Object.assign(body, { name, rating, text, productLabel });
    const res = await fetch("/api/admin/reviews", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setLoading(false);
    if (!res.ok) { setError((await res.json().catch(() => ({}))).error || "Couldn't save."); return; }
    onDone();
  }

  return (
    <form onSubmit={save} className="space-y-3 mb-3">
      {isFb && (
        <>
          <input className={inputCls} value={name} onChange={e => setName(e.target.value)} maxLength={80} aria-label="Reviewer's name" />
          <Stars value={rating} onChange={setRating} />
          <textarea className={inputCls} rows={4} value={text} onChange={e => setText(e.target.value)} maxLength={2000} aria-label="Review" />
          <input className={inputCls} value={productLabel} onChange={e => setProductLabel(e.target.value)} maxLength={100} placeholder="What they bought (optional)" />
        </>
      )}
      <div>
        <label className="block text-xs text-[#1E3A5F]/50 mb-1">Date shown on the review</label>
        <input type="date" className={inputCls + " max-w-[200px]"} value={date} max={todayInput()} onChange={e => setDate(e.target.value)} />
      </div>
      {error && <p className="text-ember text-xs">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={loading} className="bg-[#1E3A5F] text-white px-3 py-1.5 rounded-md text-xs font-semibold disabled:opacity-60">{loading ? "Saving..." : "Save"}</button>
        <button type="button" onClick={onCancel} className="text-xs text-[#1E3A5F]/60 px-2">Cancel</button>
      </div>
    </form>
  );
}

export default function AdminReviewsManager({ reviews }: { reviews: Review[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
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
      <AddFacebookReview onDone={() => { setFilter("approved"); router.refresh(); }} />

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
                  <div className="font-semibold text-[#1E3A5F]">{review.productTitle || (review.source === "facebook" ? "Facebook review" : "")}</div>
                  <div className="text-xs text-[#1E3A5F]/50">
                    {review.customerName}
                    {review.source === "facebook"
                      ? " · via Facebook"
                      : <> · <a href={`/admin/orders/${review.orderId}`} className="hover:underline">View order</a></>}
                    {" · "}{reviewDateDisplay(review.created_at)}
                  </div>
                </div>
                <div className="text-amber text-base leading-none">{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</div>
              </div>
              {editingId === review.id ? (
                <EditReview review={review} onCancel={() => setEditingId(null)} onDone={() => { setEditingId(null); router.refresh(); }} />
              ) : (
                review.review_text && <p className="text-sm text-[#1E3A5F]/70 mb-3">{review.review_text}</p>
              )}
              <div className="flex gap-2 items-center">
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
                {editingId !== review.id && (
                  <button onClick={() => setEditingId(review.id)} className="border border-[#1E3A5F]/20 text-[#1E3A5F] px-3 py-1.5 rounded-md text-xs font-semibold">
                    Edit{review.source === "facebook" ? "" : " date"}
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
