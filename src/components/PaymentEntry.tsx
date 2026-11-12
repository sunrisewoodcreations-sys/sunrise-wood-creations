"use client";

import { useState } from "react";

const METHODS = [
  { key: "cash", label: "Cash" },
  { key: "card", label: "Credit / debit card" },
  { key: "check", label: "Check" },
  { key: "venmo", label: "Venmo" },
  { key: "zelle", label: "Zelle" }
];

// Amount + how they paid (+ transaction number). Used for the deposit prompt
// and for adding any later payment. Calls onSaved after the payment is saved.
export default function PaymentEntry({
  orderId, defaultAmount, buttonLabel, onSaved, onCancel
}: {
  orderId: string;
  defaultAmount?: string;
  buttonLabel: string;
  onSaved: () => void | Promise<void>;
  onCancel?: () => void;
}) {
  const [amount, setAmount] = useState(defaultAmount || "");
  const [method, setMethod] = useState("");
  const [reference, setReference] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    setError("");
    const dollars = parseFloat(amount);
    if (!(dollars > 0)) { setError("Enter how much was paid."); return; }
    if (!method) { setError("Choose how they paid."); return; }
    setLoading(true);
    const res = await fetch(`/api/orders/${orderId}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amountCents: Math.round(dollars * 100), method, reference })
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Couldn't save that payment.");
      setLoading(false);
      return;
    }
    await onSaved();
    setLoading(false);
    setAmount(""); setMethod(""); setReference("");
  }

  const needsRef = method === "venmo" || method === "zelle";
  return (
    <form onSubmit={save} className="space-y-2">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-[#1E3A5F]/50 text-xs mb-1">Amount</label>
          <div className="flex items-center gap-1">
            <span className="text-[#1E3A5F]/60">$</span>
            <input type="number" inputMode="decimal" step="0.01" min="0" value={amount} onChange={e => setAmount(e.target.value)}
              className="w-28 border border-[#1E3A5F]/15 rounded-md px-2 py-1.5 text-sm bg-white" />
          </div>
        </div>
        <div>
          <label className="block text-[#1E3A5F]/50 text-xs mb-1">How they paid</label>
          <select value={method} onChange={e => setMethod(e.target.value)} className="border border-[#1E3A5F]/15 rounded-md px-2 py-1.5 text-sm bg-white">
            <option value="">Choose…</option>
            {METHODS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
        </div>
      </div>
      {method && method !== "cash" && (
        <div>
          <label className="block text-[#1E3A5F]/50 text-xs mb-1">
            {method === "venmo" ? "Venmo transaction number" : method === "zelle" ? "Zelle transaction number" : method === "check" ? "Check number (optional)" : "Receipt # or last 4 digits (optional)"}
          </label>
          <input value={reference} onChange={e => setReference(e.target.value)} maxLength={100}
            placeholder={needsRef ? "Paste or type the transaction number" : "Optional"}
            className="w-full max-w-xs border border-[#1E3A5F]/15 rounded-md px-2 py-1.5 text-sm bg-white" />
        </div>
      )}
      {error && <p className="text-ember text-xs">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={loading} className="bg-[#1E3A5F] text-white px-4 py-1.5 rounded-md text-xs font-semibold disabled:opacity-60">
          {loading ? "Saving..." : buttonLabel}
        </button>
        {onCancel && <button type="button" onClick={onCancel} className="text-xs text-[#1E3A5F]/60 px-2">Cancel</button>}
      </div>
    </form>
  );
}
