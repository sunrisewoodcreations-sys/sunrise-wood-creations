"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AddressInput from "@/components/AddressInput";

// First step of delivery scheduling: the customer enters where we're
// delivering. The server checks it with Google and works out the drive
// time, then the page reloads showing only times that really fit.
export default function DeliveryAddressStep({
  apiEndpoint,
  orderTitle,
  customerName,
  initialAddress
}: {
  apiEndpoint: string;
  orderTitle: string;
  customerName: string;
  initialAddress?: string;
}) {
  const router = useRouter();
  const [address, setAddress] = useState(initialAddress || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [suggestion, setSuggestion] = useState<{ address: string; reason: string } | null>(null);

  async function submit(confirm: boolean, addr: string) {
    setBusy(true);
    setError("");
    const res = await fetch(apiEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: addr, confirmAddress: confirm })
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (body.needsConfirmation) {
      setSuggestion({ address: body.suggestedAddress, reason: body.reason });
      return;
    }
    if (!res.ok) {
      setError(body.error || "Couldn't check that address.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-10">
      <div className="bg-white border border-walnut/10 rounded-xl p-6">
        <h1 className="font-display text-2xl text-walnut mb-1">Schedule Your Delivery</h1>
        <p className="text-sm text-walnut/60 mb-4">Sunrise Wood Creations · {customerName}</p>
        <div className="border-t border-b border-walnut/10 py-4 mb-4">
          <div className="text-xs font-semibold text-walnut/50 uppercase">Order</div>
          <div className="font-semibold text-walnut">{orderTitle}</div>
        </div>

        <label className="block text-xs font-semibold text-walnut mb-1">Where should we deliver?</label>
        <div className="mb-3">
          <AddressInput
            value={address}
            onChange={v => { setAddress(v); setSuggestion(null); }}
            suggestEndpoint={`${apiEndpoint}/suggest`}
            placeholder="Start typing your street address"
            className="w-full border border-walnut/15 rounded-md px-3 py-2 text-sm"
          />
        </div>

        {suggestion && (
          <div className="bg-amber/10 border border-amber/30 rounded-lg p-3 mb-3">
            <p className="text-sm text-walnut/80 mb-2">{suggestion.reason} Is this the right address?</p>
            <p className="text-sm font-semibold text-walnut mb-2">{suggestion.address}</p>
            <div className="flex gap-2">
              <button disabled={busy} onClick={() => { setAddress(suggestion.address); submit(true, suggestion.address); }} className="bg-sage text-white rounded-md px-3 py-1.5 text-xs font-bold disabled:opacity-50">Yes, use this</button>
              <button onClick={() => setSuggestion(null)} className="border border-walnut/20 text-walnut rounded-md px-3 py-1.5 text-xs font-semibold">No, let me edit</button>
            </div>
          </div>
        )}

        {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 mb-3">{error}</p>}

        <button
          onClick={() => submit(false, address)}
          disabled={busy || address.trim().length < 5}
          className="w-full bg-accent text-white rounded-md py-3 text-sm font-bold disabled:opacity-50"
        >
          {busy ? "Checking address..." : "Continue"}
        </button>
      </div>
    </div>
  );
}
