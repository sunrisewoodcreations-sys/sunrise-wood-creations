"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeliverySettingsForm({
  initialHomeAddress,
  initialPerMileCents,
  initialMinimumCents,
  mapsConnected
}: {
  initialHomeAddress: string;
  initialPerMileCents: number;
  initialMinimumCents: number;
  mapsConnected: boolean;
}) {
  const router = useRouter();
  const [homeAddress, setHomeAddress] = useState(initialHomeAddress);
  const [perMile, setPerMile] = useState(initialPerMileCents > 0 ? (initialPerMileCents / 100).toFixed(2) : "");
  const [minimum, setMinimum] = useState(initialMinimumCents > 0 ? (initialMinimumCents / 100).toFixed(2) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [suggestion, setSuggestion] = useState<{ address: string; reason: string } | null>(null);

  async function save(address: string, confirmAddress: boolean) {
    setBusy(true);
    setError("");
    setSaved("");
    const res = await fetch("/api/delivery/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        homeAddress: address,
        perMileCents: Math.round((Number(perMile) || 0) * 100),
        minimumCents: Math.round((Number(minimum) || 0) * 100),
        confirmAddress
      })
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(body.error || "Couldn't save.");
      return;
    }
    if (body.needsConfirmation) {
      setSuggestion({ address: body.suggestedAddress, reason: body.reason });
      return;
    }
    setSuggestion(null);
    setHomeAddress(body.homeAddress);
    setSaved(body.note || "Saved.");
    router.refresh();
  }

  return (
    <div>
      <h1 className="font-display text-2xl text-[#1E3A5F] mb-1">Delivery Settings</h1>
      <p className="text-sm text-[#1E3A5F]/60 mb-6">
        Used by the "Calculate delivery" button on quotes. Delivery is charged one way, from your home address to the customer.
      </p>

      {!mapsConnected && (
        <div className="mb-5 border border-amber/40 bg-amber/10 rounded-md p-3 text-sm text-[#1E3A5F]">
          Google Maps isn't connected yet, so addresses can't be checked or measured. You can save these settings now, but
          "Calculate delivery" won't work until the Google Maps key is added.
        </div>
      )}

      <div className="bg-white border border-[#1E3A5F]/10 rounded-xl p-5 max-w-xl space-y-4">
        <div>
          <label className="block text-xs font-semibold text-[#1E3A5F] mb-1">Your home address (where deliveries start)</label>
          <input
            value={homeAddress}
            onChange={e => setHomeAddress(e.target.value)}
            placeholder="123 Main St, Town, MI 49000"
            className="w-full px-3 py-2 border border-[#1E3A5F]/15 rounded-md text-sm"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#1E3A5F] mb-1">Price per mile ($)</label>
            <input
              value={perMile}
              onChange={e => setPerMile(e.target.value)}
              inputMode="decimal"
              placeholder="1.25"
              className="w-full px-3 py-2 border border-[#1E3A5F]/15 rounded-md text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#1E3A5F] mb-1">Minimum fee ($, optional)</label>
            <input
              value={minimum}
              onChange={e => setMinimum(e.target.value)}
              inputMode="decimal"
              placeholder="10.00"
              className="w-full px-3 py-2 border border-[#1E3A5F]/15 rounded-md text-sm"
            />
          </div>
        </div>

        {suggestion && (
          <div className="border border-amber/40 bg-amber/10 rounded-md p-3 text-sm text-[#1E3A5F]">
            <p className="font-semibold mb-1">Did you mean: {suggestion.address}?</p>
            <p className="text-xs text-[#1E3A5F]/70 mb-2">{suggestion.reason}</p>
            <div className="flex gap-2">
              <button onClick={() => save(suggestion.address, true)} disabled={busy} className="bg-ember text-white px-3 py-1.5 rounded-md text-xs font-semibold disabled:opacity-60">
                Yes, use that address
              </button>
              <button onClick={() => setSuggestion(null)} className="text-xs underline text-[#1E3A5F]/60">No, let me fix it</button>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3">
          <button onClick={() => save(homeAddress, false)} disabled={busy} className="bg-ember text-white px-4 py-2 rounded-md text-sm font-semibold disabled:opacity-60">
            {busy ? "Saving..." : "Save settings"}
          </button>
          {saved && <span className="text-sm text-sage font-semibold">{saved}</span>}
          {error && <span className="text-sm text-ember">{error}</span>}
        </div>
      </div>
    </div>
  );
}
