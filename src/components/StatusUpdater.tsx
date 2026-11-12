"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { stepsFor, ProductType } from "@/lib/statusSteps";
import PaymentEntry from "@/components/PaymentEntry";

export default function StatusUpdater({ orderId, productType, currentStatus, fulfillmentMethod }: {
  fulfillmentMethod?: string | null;
  orderId: string;
  productType: ProductType;
  currentStatus: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(currentStatus);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const steps = stepsFor(productType, fulfillmentMethod);

  const [askDeposit, setAskDeposit] = useState(false);

  async function handleChange(newStatus: string) {
    // Marking the deposit received means asking how much and how it was paid;
    // the status only changes once that payment is saved.
    if (newStatus === "deposit_received" && currentStatus !== "deposit_received") {
      setAskDeposit(true);
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

  return (
    <div>
      <div className="flex items-center gap-3">
        <select
          value={askDeposit ? "deposit_received" : status}
          onChange={e => handleChange(e.target.value)}
          disabled={loading}
          className="border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm"
        >
          {steps.map(s => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>
        {loading && <span className="text-xs text-[#1E3A5F]/50">Saving...</span>}
        {saved && <span className="text-xs text-sage font-semibold">Saved — customer notified by email</span>}
      </div>
      {askDeposit && (
        <div className="mt-3 bg-cream border border-[#1E3A5F]/10 rounded-lg p-4">
          <div className="text-sm font-semibold text-[#1E3A5F] mb-2">How much was the deposit?</div>
          <PaymentEntry
            orderId={orderId}
            buttonLabel="Save deposit"
            onSaved={async () => { setAskDeposit(false); await applyStatus("deposit_received"); }}
            onCancel={() => setAskDeposit(false)}
          />
        </div>
      )}
      {error && <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 mt-2">{error}</p>}
    </div>
  );
}
