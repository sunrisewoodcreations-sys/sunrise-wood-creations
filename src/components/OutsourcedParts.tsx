"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const STEPS = [
  { value: "not_ordered", label: "Not ordered" },
  { value: "ordered", label: "Ordered" },
  { value: "shipped", label: "Shipped" },
  { value: "received", label: "Received" }
];

function fmt(iso?: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" });
}

function PartRow({ label, part, value, at, orderId }: { label: string; part: "tops" | "frames"; value: string; at?: string | null; orderId: string }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function set(next: string) {
    if (next === value) return;
    setSaving(true);
    await fetch(`/api/orders/${orderId}/sourcing`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [part]: next })
    });
    setSaving(false);
    router.refresh();
  }

  return (
    <div className="mb-3 last:mb-0">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-semibold text-[#1E3A5F]">{label}</span>
        <span className="text-xs text-[#1E3A5F]/50">{value !== "not_ordered" && at ? `Updated ${fmt(at)}` : ""}</span>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {STEPS.map(s => (
          <button
            key={s.value}
            type="button"
            disabled={saving}
            onClick={() => set(s.value)}
            className={`rounded-md px-1 py-2 text-xs font-semibold border disabled:opacity-60 ${
              value === s.value ? "bg-[#1E3A5F] text-white border-[#1E3A5F]" : "bg-white text-[#1E3A5F]/70 border-[#1E3A5F]/20"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// Admin-only: where the outsourced tops and frames are. Customers never see this.
export default function OutsourcedParts({ orderId, tops, frames, topsAt, framesAt }: { orderId: string; tops: string; frames: string; topsAt?: string | null; framesAt?: string | null }) {
  return (
    <div className="mb-6 pb-6 border-b border-[#1E3A5F]/10">
      <h3 className="font-semibold text-[#1E3A5F] text-sm mb-1">Tops &amp; frames (only you can see this)</h3>
      <p className="text-xs text-[#1E3A5F]/50 mb-3">Track where the outsourced parts are. Customers don&apos;t see this.</p>
      <PartRow label="Tops" part="tops" value={tops} at={topsAt} orderId={orderId} />
      <PartRow label="Frames" part="frames" value={frames} at={framesAt} orderId={orderId} />
    </div>
  );
}
