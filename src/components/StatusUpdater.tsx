"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { stepsFor, ProductType } from "@/lib/statusSteps";

export default function StatusUpdater({ orderId, productType, currentStatus, fulfillmentMethod }: {
  orderId: string;
  productType: ProductType;
  currentStatus: string;
  fulfillmentMethod?: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(currentStatus);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const steps = stepsFor(productType);

  // Pickup-specific choice, shown only when moving TO ready_for_pickup
  // on an order that's actually fulfilled by pickup — everything else
  // (delivery/shipping orders, every other status change) behaves
  // exactly as it always has, going straight through handleChange.
  const [showPickupChoice, setShowPickupChoice] = useState(false);
  const [pickupMode, setPickupMode] = useState<"send_email" | "already_scheduled">("send_email");
  const [manualDate, setManualDate] = useState("");
  const [manualTime, setManualTime] = useState("");
  const [pickupBusy, setPickupBusy] = useState(false);
  const [pickupSaved, setPickupSaved] = useState("");

  async function handleChange(newStatus: string) {
    if (newStatus === "ready_for_pickup" && fulfillmentMethod === "pickup") {
      setStatus(newStatus);
      setShowPickupChoice(true);
      return;
    }
    await applyStatus(newStatus);
  }

  async function applyStatus(newStatus: string) {
    setStatus(newStatus);
    setLoading(true);
    setSaved(false);
    setError("");
    const res = await fetch(`/api/orders/${orderId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus })
    });
    setLoading(false);
    if (res.ok) {
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 2500);
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Couldn't save that change.");
    }
  }

  async function handlePickupChoiceConfirm() {
    setPickupBusy(true);
    setError("");

    // First, the existing status transition — unchanged: still
    // generates the invoice and sends the existing "your order is
    // ready" email with balance-due info, exactly as it always has.
    await applyStatus("ready_for_pickup");

    // Then, the pickup-scheduling-specific step layered on top.
    const res = await fetch(`/api/orders/${orderId}/pickup-scheduling`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        pickupMode === "send_email"
          ? { mode: "send_email" }
          : { mode: "already_scheduled", dateStr: manualDate, time: manualTime }
      )
    });
    const body = await res.json().catch(() => ({}));
    setPickupBusy(false);

    if (!res.ok) {
      setError(body.error || "Order marked ready, but the pickup scheduling step failed.");
      return;
    }
    if (body.emailWarning) {
      setError(`Appointment saved, but the confirmation email failed: ${body.emailWarning}`);
    } else {
      setPickupSaved(pickupMode === "send_email" ? "Scheduling email sent." : "Appointment saved and confirmed.");
    }
    setShowPickupChoice(false);
    router.refresh();
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <select
          value={status}
          onChange={e => handleChange(e.target.value)}
          disabled={loading}
          className="border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm"
        >
          {steps.map(s => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>
        {loading && <span className="text-xs text-[#1E3A5F]/50">Saving...</span>}
        {saved && !showPickupChoice && <span className="text-xs text-sage font-semibold">Saved — customer notified by email</span>}
        {pickupSaved && <span className="text-xs text-sage font-semibold">{pickupSaved}</span>}
      </div>
      {error && <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 mt-2">{error}</p>}

      {showPickupChoice && (
        <div className="mt-3 bg-cream border border-[#1E3A5F]/20 rounded-lg p-4 max-w-md">
          <p className="text-sm font-semibold text-[#1E3A5F] mb-3">How should this pickup be scheduled?</p>
          <div className="space-y-2 mb-3">
            <label className="flex items-center gap-2 text-sm text-[#1E3A5F]">
              <input type="radio" checked={pickupMode === "send_email"} onChange={() => setPickupMode("send_email")} />
              Send Pickup Scheduling Email
            </label>
            <label className="flex items-center gap-2 text-sm text-[#1E3A5F]">
              <input type="radio" checked={pickupMode === "already_scheduled"} onChange={() => setPickupMode("already_scheduled")} />
              Already Scheduled (enter it myself)
            </label>
          </div>

          {pickupMode === "already_scheduled" && (
            <div className="flex gap-2 mb-3">
              <input type="date" value={manualDate} onChange={e => setManualDate(e.target.value)} className="border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm" />
              <input type="time" value={manualTime} onChange={e => setManualTime(e.target.value)} className="border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm" />
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handlePickupChoiceConfirm}
              disabled={pickupBusy || (pickupMode === "already_scheduled" && (!manualDate || !manualTime))}
              className="bg-[#1E3A5F] text-white rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-60"
            >
              {pickupBusy ? "Saving..." : "Confirm"}
            </button>
            <button onClick={() => { setShowPickupChoice(false); setStatus(currentStatus); }} disabled={pickupBusy} className="border border-[#1E3A5F]/20 text-[#1E3A5F] rounded-md px-4 py-2 text-sm font-semibold">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
