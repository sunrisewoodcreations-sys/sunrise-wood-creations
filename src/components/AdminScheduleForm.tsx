"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Admin-only: book a pickup/delivery for the customer at ANY date and time
// (no opening-hours limits). Delivery orders need an address the first time.
export default function AdminScheduleForm({
  orderId,
  isDelivery,
  needsAddress,
  initialAddress
}: {
  orderId: string;
  isDelivery: boolean;
  needsAddress: boolean;
  initialAddress: string;
}) {
  const router = useRouter();
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [address, setAddress] = useState(initialAddress);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const noun = isDelivery ? "delivery" : "pickup";

  async function submit(confirmAddress = false, addressOverride?: string) {
    setBusy(true);
    setError("");
    setDone("");
    const res = await fetch(`/api/orders/${orderId}/pickup-scheduling`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "already_scheduled",
        dateStr: date,
        time,
        ...(isDelivery && needsAddress ? { address: addressOverride ?? address, confirmAddress } : {})
      })
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (body.needsConfirmation) { setSuggestion(body.suggestedAddress); return; }
    if (!res.ok) { setError(body.error || "Couldn't schedule that."); return; }
    setSuggestion(null);
    setDone(body.emailWarning ? `Scheduled, but the confirmation email failed: ${body.emailWarning}` : "Scheduled — the customer was emailed.");
    router.refresh();
  }

  return (
    <div className="mt-4 pt-4 border-t border-[#1E3A5F]/10">
      <div className="text-xs font-semibold text-[#1E3A5F]/50 uppercase tracking-wide mb-2">Schedule {noun}</div>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="sched-date" className="block text-[10px] text-[#1E3A5F]/60 mb-0.5">Date</label>
          <input id="sched-date" type="date" value={date} onChange={e => setDate(e.target.value)} className="border border-[#1E3A5F]/15 rounded-md px-2 py-1.5 text-sm bg-white" />
        </div>
        <div>
          <label htmlFor="sched-time" className="block text-[10px] text-[#1E3A5F]/60 mb-0.5">Time (any time you like)</label>
          <input id="sched-time" type="time" value={time} onChange={e => setTime(e.target.value)} className="border border-[#1E3A5F]/15 rounded-md px-2 py-1.5 text-sm bg-white" />
        </div>
        {isDelivery && needsAddress && (
          <div className="flex-1 min-w-[220px]">
            <label htmlFor="sched-addr" className="block text-[10px] text-[#1E3A5F]/60 mb-0.5">Delivery address</label>
            <input id="sched-addr" value={address} onChange={e => setAddress(e.target.value)} className="w-full border border-[#1E3A5F]/15 rounded-md px-2 py-1.5 text-sm bg-white" />
          </div>
        )}
        <button
          type="button"
          onClick={() => submit(false)}
          disabled={busy || !date || !time || (isDelivery && needsAddress && !address.trim())}
          className="bg-[#1E3A5F] text-white rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-60"
        >
          {busy ? "Scheduling..." : `Schedule ${noun}`}
        </button>
      </div>
      {suggestion && (
        <div className="mt-2 text-sm bg-amber/10 border border-amber/30 rounded-md px-3 py-2">
          Did you mean <strong>{suggestion}</strong>?{" "}
          <button type="button" onClick={() => { setAddress(suggestion); submit(true, suggestion); }} className="font-semibold text-[#1E3A5F] underline">Yes, use it</button>
        </div>
      )}
      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 mt-2">{error}</p>}
      {done && <p className="text-sm text-sage font-semibold mt-2">{done}</p>}
    </div>
  );
}
