"use client";

import { useState } from "react";
import AddressInput from "@/components/AddressInput";

export type OrderDelivery = { address: string; miles: number | null; feeDollars: string };

export const EMPTY_ORDER_DELIVERY: OrderDelivery = { address: "", miles: null, feeDollars: "" };

// Optional "this order is being delivered" block for the Add Order form.
// Type an address (suggestions appear as you type), tap Calculate, and
// the one-way mileage fee is filled in. The fee can still be edited by
// hand, or typed in directly with no address at all. Nothing is saved
// here: the parent turns it into a "Delivery fee" line on the order.
export default function OrderDeliveryFields({
  value,
  onChange,
  customerName,
  customerAddress
}: {
  value: OrderDelivery;
  onChange: (next: OrderDelivery) => void;
  customerName?: string;
  customerAddress?: string | null;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [suggestion, setSuggestion] = useState<{ address: string; reason: string } | null>(null);

  async function calculate(address: string, confirmAddress: boolean) {
    setBusy(true);
    setError("");
    setSuggestion(null);
    try {
      const res = await fetch("/api/delivery/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, confirmAddress })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || "Couldn't calculate delivery.");
      } else if (body.needsConfirmation) {
        setSuggestion({ address: body.suggestedAddress, reason: body.reason });
      } else {
        onChange({ address: body.address, miles: body.miles, feeDollars: (body.feeCents / 100).toFixed(2) });
        setNote(
          body.minimumApplied
            ? `${body.miles} miles - minimum delivery fee of $${(body.minimumCents / 100).toFixed(2)} applied`
            : `${body.miles} miles x $${(body.perMileCents / 100).toFixed(2)}/mile = $${(body.feeCents / 100).toFixed(2)}`
        );
      }
    } catch {
      setError("Couldn't reach the server. Try again.");
    }
    setBusy(false);
  }

  return (
    <div className="border border-[#1E3A5F]/10 rounded-md p-3 bg-[#1E3A5F]/[0.02]">
      <label className="block text-xs font-semibold text-[#1E3A5F] mb-1">Delivery (optional)</label>
      <p className="text-xs text-[#1E3A5F]/60 mb-2">
        Leave blank for pickup. To deliver, enter the address and tap Calculate. It's priced one way by the mile from your home and added to the order as a "Delivery fee" line.
      </p>
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex-1">
          <AddressInput
            value={value.address}
            onChange={v => { onChange({ ...value, address: v, miles: null }); setNote(""); setSuggestion(null); }}
          />
        </div>
        <button
          type="button"
          onClick={() => calculate(value.address, false)}
          disabled={busy || value.address.trim().length < 5}
          className="bg-ember text-white px-4 py-2 rounded-md text-sm font-semibold disabled:opacity-60"
        >
          {busy ? "Calculating..." : "Calculate delivery"}
        </button>
      </div>
      {!value.address.trim() && customerAddress && (
        <button
          type="button"
          onClick={() => { onChange({ ...value, address: customerAddress, miles: null }); setNote(""); }}
          className="mt-2 text-xs font-semibold underline text-ember"
        >
          Use {customerName ? `${customerName}'s` : "the customer's"} address: {customerAddress}
        </button>
      )}
      {suggestion && (
        <div className="mt-2 text-sm text-[#1E3A5F]">
          <p className="font-semibold">Did you mean: {suggestion.address}?</p>
          <p className="text-xs text-[#1E3A5F]/70 mb-2">{suggestion.reason}</p>
          <button type="button" onClick={() => calculate(suggestion.address, true)} className="text-xs font-semibold underline text-ember">
            Yes, use that address
          </button>
        </div>
      )}
      <div className="mt-3 max-w-[10rem]">
        <label className="block text-[11px] font-semibold text-[#1E3A5F] mb-1">Delivery fee ($)</label>
        <input
          value={value.feeDollars}
          onChange={e => onChange({ ...value, feeDollars: e.target.value })}
          inputMode="decimal"
          placeholder="0.00"
          className="w-full border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm"
        />
      </div>
      {note && <p className="mt-2 text-sm text-sage font-semibold">{note}. You can still adjust the fee.</p>}
      {error && <p className="mt-2 text-sm text-ember">{error}</p>}
    </div>
  );
}
