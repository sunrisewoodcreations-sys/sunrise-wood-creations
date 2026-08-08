"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NotificationPrefsForm({
  initialOrderUpdates,
  initialInvoices,
  initialProofs,
  initialMessages
}: {
  initialOrderUpdates: boolean;
  initialInvoices: boolean;
  initialProofs: boolean;
  initialMessages: boolean;
}) {
  const router = useRouter();
  const [orderUpdates, setOrderUpdates] = useState(initialOrderUpdates);
  const [invoices, setInvoices] = useState(initialInvoices);
  const [proofs, setProofs] = useState(initialProofs);
  const [messages, setMessages] = useState(initialMessages);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setSaved(false);

    const res = await fetch("/api/account/notification-prefs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        notifyOrderUpdates: orderUpdates,
        notifyInvoices: invoices,
        notifyProofs: proofs,
        notifyMessages: messages
      })
    });

    setLoading(false);
    if (res.ok) {
      setSaved(true);
      router.refresh();
    }
  }

  return (
    <form onSubmit={handleSave} className="bg-white border border-walnut/10 rounded-xl p-6 space-y-3 max-w-md">
      <h2 className="font-display text-lg text-walnut mb-1">Email preferences</h2>
      <p className="text-sm text-walnut/60 mb-3">Choose which emails you'd like to receive from us.</p>

      <label className="flex items-center gap-2 text-sm text-walnut/80">
        <input type="checkbox" className="w-auto" checked={orderUpdates} onChange={e => setOrderUpdates(e.target.checked)} />
        Order status updates
      </label>
      <label className="flex items-center gap-2 text-sm text-walnut/80">
        <input type="checkbox" className="w-auto" checked={invoices} onChange={e => setInvoices(e.target.checked)} />
        Invoices
      </label>
      <label className="flex items-center gap-2 text-sm text-walnut/80">
        <input type="checkbox" className="w-auto" checked={proofs} onChange={e => setProofs(e.target.checked)} />
        Design proofs ready for review
      </label>
      {!proofs && (
        <p className="text-xs text-ember">
          Heads up: for cornhole orders, this is how you approve or request changes on your design — turning it off means we'd need to reach you another way.
        </p>
      )}
      <label className="flex items-center gap-2 text-sm text-walnut/80">
        <input type="checkbox" className="w-auto" checked={messages} onChange={e => setMessages(e.target.checked)} />
        New messages from the shop
      </label>

      <button
        type="submit"
        disabled={loading}
        className="bg-walnut text-cream px-5 py-2.5 rounded-md font-semibold text-sm disabled:opacity-60 mt-2"
      >
        {loading ? "Saving..." : "Save preferences"}
      </button>
      {saved && <span className="ml-3 text-sage text-sm font-semibold">Saved</span>}
    </form>
  );
}
