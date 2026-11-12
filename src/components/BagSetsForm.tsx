"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BagSet } from "@/lib/bagSets";

type Row = { label: string; price: string };

export default function BagSetsForm({ initial }: { initial: BagSet[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(
    initial.length ? initial.map(b => ({ label: b.label, price: (b.priceCents / 100).toString() })) : [{ label: "", price: "" }]
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  function update(i: number, patch: Partial<Row>) {
    setSaved(false);
    setRows(r => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }

  async function save() {
    setBusy(true); setError(""); setSaved(false);
    const bagSets = rows
      .filter(r => r.label.trim())
      .map(r => ({ label: r.label.trim(), priceCents: Math.round((Number(r.price) || 0) * 100) }));
    const res = await fetch("/api/admin/bag-sets", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bagSets })
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(body.error || "Couldn't save."); return; }
    setRows(body.bagSets.length ? body.bagSets.map((b: BagSet) => ({ label: b.label, price: (b.priceCents / 100).toString() })) : [{ label: "", price: "" }]);
    setSaved(true);
    router.refresh();
  }

  return (
    <div>
      <h1 className="font-display text-2xl text-[#1E3A5F] mb-1">Cornhole Bag Sets</h1>
      <p className="text-sm text-[#1E3A5F]/60 mb-6">
        The bag sets you offer with cornhole boards. When you add an order that has cornhole boards, these show up as one-tap "add bags" buttons and appear as their own line on the invoice. Prices include tax, like all your prices.
      </p>
      <div className="bg-white border border-[#1E3A5F]/10 rounded-xl p-5 max-w-xl space-y-3">
        {rows.map((row, i) => (
          <div key={i} className="grid grid-cols-[1fr_110px_auto] gap-2 items-end">
            <div>
              <label className="block text-[11px] font-semibold text-[#1E3A5F] mb-1">Name</label>
              <input value={row.label} onChange={e => update(i, { label: e.target.value })} placeholder="Set of 8" className="w-full border border-[#1E3A5F]/15 rounded-md px-2 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#1E3A5F] mb-1">Price ($)</label>
              <input value={row.price} inputMode="decimal" onChange={e => update(i, { price: e.target.value })} placeholder="40" className="w-full border border-[#1E3A5F]/15 rounded-md px-2 py-2 text-sm" />
            </div>
            <button type="button" onClick={() => { setSaved(false); setRows(r => (r.length === 1 ? [{ label: "", price: "" }] : r.filter((_, idx) => idx !== i))); }} className="text-xs text-ember underline pb-2.5">Remove</button>
          </div>
        ))}
        <button type="button" onClick={() => setRows(r => [...r, { label: "", price: "" }])} className="text-xs font-semibold text-[#1E3A5F] border border-[#1E3A5F]/20 rounded-md px-3 py-1.5">+ Add another size</button>
        <div className="flex items-center gap-3 pt-2">
          <button onClick={save} disabled={busy} className="bg-ember text-white px-4 py-2.5 rounded-md text-sm font-semibold disabled:opacity-60">{busy ? "Saving..." : "Save bag sets"}</button>
          {saved && <span className="text-sm text-sage font-semibold">Saved.</span>}
          {error && <span className="text-sm text-ember">{error}</span>}
        </div>
      </div>
    </div>
  );
}
