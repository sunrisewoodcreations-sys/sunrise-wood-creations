"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type PendingBatch = {
  id: string;
  name: string;
  createdAt: string;
  items: { productId: string; name: string; quantity: number; added?: number }[];
};

function Batch({ batch }: { batch: PendingBatch }) {
  const router = useRouter();
  const [qty, setQty] = useState<Record<string, string>>(
    Object.fromEntries(batch.items.map(i => [i.productId, String(i.quantity)]))
  );
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  async function send(body: object, key: string) {
    setBusy(key);
    setError("");
    setNote("");
    try {
      const res = await fetch(`/api/cutlist/saved/${batch.id}/inventory`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        if (data.notified) {
          const who = data.notified.customerName ? `${data.notified.customerName}'s order` : "the oldest waiting order";
          setNote(data.notified.emailed
            ? `Added. ${who} ("${data.notified.title}") was marked ready and they were emailed.`
            : `Added. ${who} ("${data.notified.title}") was marked ready, but the email may not have sent — check that order.`);
        } else {
          setNote("Added to stock. No waiting order needed it.");
        }
        router.refresh();
        setBusy("");
        return;
      }
      setError(data.error || "Couldn't do that. Try again.");
    } catch {
      setError("Couldn't do that. Check your connection and try again.");
    }
    setBusy("");
  }

  function dismiss() {
    if (window.confirm("Remove this from the list without adding anything else to inventory?")) send({ action: "dismiss" }, "dismiss");
  }

  return (
    <li className="px-4 py-3">
      <div className="text-sm font-semibold text-walnut">{batch.name}</div>
      <div className="text-xs text-walnut/60 mb-2">Saved {new Date(batch.createdAt).toLocaleDateString()}</div>
      <ul className="space-y-2 mb-3">
        {batch.items.map(i => (
          <li key={i.productId} className="flex flex-wrap items-center justify-between gap-2">
            <label htmlFor={`qty-${batch.id}-${i.productId}`} className="text-sm text-walnut">{i.name}</label>
            {i.added != null ? (
              <span className="text-sm font-semibold text-sage">✓ {i.added} added</span>
            ) : (
              <span className="flex items-center gap-2">
                <input
                  id={`qty-${batch.id}-${i.productId}`}
                  type="number" inputMode="numeric" min={1} step={1}
                  value={qty[i.productId] ?? ""}
                  onChange={e => setQty({ ...qty, [i.productId]: e.target.value })}
                  className="w-20 border border-walnut/20 rounded-md px-2 py-1.5 text-sm text-right bg-white"
                />
                <button type="button" disabled={!!busy}
                  onClick={() => send({ action: "add", productId: i.productId, quantity: Number(qty[i.productId]) || 0 }, i.productId)}
                  className="bg-accent text-white px-3 py-1.5 rounded-md text-sm font-semibold disabled:opacity-60">
                  {busy === i.productId ? "Adding..." : "Add to stock"}
                </button>
              </span>
            )}
          </li>
        ))}
      </ul>
      {note && <p role="status" className="text-xs text-sage font-semibold mb-2">{note}</p>}
      {error && <p role="alert" className="text-xs text-ember mb-2">{error}</p>}
      <button type="button" onClick={dismiss} disabled={!!busy}
        className="border border-walnut/30 text-walnut px-3 py-1.5 rounded-md text-xs disabled:opacity-60">
        Not needed
      </button>
    </li>
  );
}

export default function PendingInventoryBatches({ batches }: { batches: PendingBatch[] }) {
  if (batches.length === 0) return null;
  return (
    <section aria-labelledby="ready-inventory" className="mb-10 sm:mb-8">
      <h2 id="ready-inventory" className="font-display text-lg text-[#1E3A5F] mb-1">Ready to add to inventory ({batches.length})</h2>
      <p className="text-xs text-walnut/60 mb-3">Saved from the Picket Planner. Once the pieces are built, change a count if needed and press Add to stock on each product. The oldest waiting order for that product is then marked ready and the customer is emailed.</p>
      <ul className="bg-white border-2 border-accent/30 rounded-xl shadow-sm divide-y divide-walnut/10">
        {batches.map(b => <Batch key={b.id} batch={b} />)}
      </ul>
    </section>
  );
}
