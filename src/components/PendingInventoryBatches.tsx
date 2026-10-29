"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type PendingBatch = {
  id: string;
  name: string;
  createdAt: string;
  items: { productId: string; name: string; quantity: number }[];
};

function Batch({ batch }: { batch: PendingBatch }) {
  const router = useRouter();
  const [qty, setQty] = useState<Record<string, string>>(
    Object.fromEntries(batch.items.map(i => [i.productId, String(i.quantity)]))
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function send(body: object) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/cutlist/saved/${batch.id}/inventory`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (res.ok) { router.refresh(); return; }
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Couldn't do that. Try again.");
    } catch {
      setError("Couldn't do that. Check your connection and try again.");
    }
    setBusy(false);
  }

  function add() {
    const items = batch.items.map(i => ({ productId: i.productId, quantity: Number(qty[i.productId]) || 0 }));
    send({ action: "add", items });
  }

  function dismiss() {
    if (window.confirm("Remove this from the list without adding anything to inventory?")) send({ action: "dismiss" });
  }

  return (
    <li className="px-4 py-3">
      <div className="text-sm font-semibold text-walnut">{batch.name}</div>
      <div className="text-xs text-walnut/60 mb-2">Saved {new Date(batch.createdAt).toLocaleDateString()}</div>
      <ul className="space-y-2 mb-3">
        {batch.items.map(i => (
          <li key={i.productId} className="flex items-center justify-between gap-3">
            <label htmlFor={`qty-${batch.id}-${i.productId}`} className="text-sm text-walnut">{i.name}</label>
            <input
              id={`qty-${batch.id}-${i.productId}`}
              type="number" inputMode="numeric" min={0} step={1}
              value={qty[i.productId] ?? ""}
              onChange={e => setQty({ ...qty, [i.productId]: e.target.value })}
              className="w-20 border border-walnut/20 rounded-md px-2 py-1.5 text-sm text-right bg-white"
            />
          </li>
        ))}
      </ul>
      {error && <p role="alert" className="text-xs text-ember mb-2">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={add} disabled={busy}
          className="bg-accent text-white px-4 py-2 rounded-md text-sm font-semibold disabled:opacity-60">
          {busy ? "Working..." : "Add to inventory"}
        </button>
        <button type="button" onClick={dismiss} disabled={busy}
          className="border border-walnut/30 text-walnut px-3 py-2 rounded-md text-sm disabled:opacity-60">
          Not needed
        </button>
      </div>
    </li>
  );
}

export default function PendingInventoryBatches({ batches }: { batches: PendingBatch[] }) {
  if (batches.length === 0) return null;
  return (
    <section aria-labelledby="ready-inventory" className="mb-10 sm:mb-8">
      <h2 id="ready-inventory" className="font-display text-lg text-[#1E3A5F] mb-1">Ready to add to inventory ({batches.length})</h2>
      <p className="text-xs text-walnut/60 mb-3">Saved from the Picket Planner. Once the pieces are built, change the counts if needed and press Add to inventory.</p>
      <ul className="bg-white border-2 border-accent/30 rounded-xl shadow-sm divide-y divide-walnut/10">
        {batches.map(b => <Batch key={b.id} batch={b} />)}
      </ul>
    </section>
  );
}
