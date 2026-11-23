"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AdminButton from "@/components/AdminButton";
import { BagSet, bagLineTitle } from "@/lib/bagSets";

type SavedProduct = { id: string; product_type: string; name: string; size_details: string | null; price_cents: number };
type Row = { productId: string | null; productType: string; title: string; sizeDetails: string; quantity: string; price: string; taxExempt?: boolean };

const blank = (): Row => ({ productId: null, productType: "other", title: "", sizeDetails: "", quantity: "1", price: "" });
const money = (c: number) => `$${(c / 100).toFixed(2)}`;
const toCents = (s: string) => Math.round((parseFloat(s) || 0) * 100);

// Add more items (e.g. cornhole bags) to an order that already exists. The
// total, the invoice and the customer email are all updated from one tap.
export default function AddItemsToOrder({
  orderId,
  currentTotalCents,
  products,
  bagSets
}: {
  orderId: string;
  currentTotalCents: number;
  products: SavedProduct[];
  bagSets: BagSet[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>([blank()]);
  const [sendEmail, setSendEmail] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  const update = (i: number, patch: Partial<Row>) => setRows(prev => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  function addBagSet(set: BagSet) {
    const line: Row = { productId: null, productType: "cornhole", title: bagLineTitle(set), sizeDetails: "", quantity: "1", price: (set.priceCents / 100).toString() };
    setRows(prev => {
      const last = prev[prev.length - 1];
      return last && !last.title.trim() && !last.price.trim() ? [...prev.slice(0, -1), line] : [...prev, line];
    });
  }

  function pickProduct(i: number, id: string) {
    if (!id) { update(i, { productId: null, productType: "other" }); return; }
    const p = products.find(x => x.id === id);
    if (!p) return;
    const qty = Math.max(1, Math.round(Number(rows[i].quantity)) || 1);
    update(i, { productId: p.id, productType: p.product_type, title: p.name, sizeDetails: p.size_details || "", price: ((p.price_cents * qty) / 100).toString() });
  }

  function changeQty(i: number, q: string) {
    const r = rows[i];
    const p = r.productId ? products.find(x => x.id === r.productId) : null;
    const qty = Math.max(1, Math.round(Number(q)) || 1);
    update(i, { quantity: q, ...(p ? { price: ((p.price_cents * qty) / 100).toString() } : {}) });
  }

  const filled = rows.filter(r => r.title.trim() && r.price.trim());
  const addedCents = filled.reduce((s, r) => s + toCents(r.price), 0);

  async function submit() {
    setError("");
    setDone("");
    if (filled.length === 0) { setError("Add at least one item with a name and price."); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/add-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sendEmail,
          items: filled.map(r => ({
            productId: r.productId, productType: r.productType, title: r.title, sizeDetails: r.sizeDetails,
            quantity: r.quantity, priceCents: toCents(r.price), taxExempt: !!r.taxExempt
          }))
        })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { setError(body.error || "Couldn't add those items."); }
      else {
        setDone(body.emailed ? "Added. The customer was emailed the new total and updated invoice." : "Added. The invoice was updated (no email sent).");
        setRows([blank()]);
        router.refresh();
      }
    } catch {
      setError("Couldn't reach the server. Try again.");
    }
    setLoading(false);
  }

  if (!open) {
    return (
      <div className="mt-4">
        <button type="button" onClick={() => setOpen(true)} className="text-sm font-semibold text-[#1E3A5F] underline">
          + Add items to this order
        </button>
        {done && <p className="text-xs text-sage font-semibold mt-1">{done}</p>}
      </div>
    );
  }

  return (
    <div className="mt-4 border border-[#1E3A5F]/15 rounded-lg p-4 bg-white">
      <h3 className="font-semibold text-[#1E3A5F] text-sm mb-1">Add items to this order</h3>
      <p className="text-xs text-[#1E3A5F]/60 mb-3">Prices include tax. The order total and the same invoice are updated for you.</p>

      {bagSets.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-[#1E3A5F]/60 mb-1">Cornhole bags</p>
          <div className="flex flex-wrap gap-2">
            {bagSets.map(s => (
              <button key={s.label} type="button" onClick={() => addBagSet(s)} className="border border-[#1E3A5F]/20 rounded-md px-3 py-1.5 text-xs font-semibold text-[#1E3A5F]">
                + {s.label} ({money(s.priceCents)})
              </button>
            ))}
          </div>
        </div>
      )}

      {rows.map((r, i) => (
        <div key={i} className="border-t border-[#1E3A5F]/10 pt-3 mt-3 space-y-2">
          <select value={r.productId || ""} onChange={e => pickProduct(i, e.target.value)} className="w-full border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm bg-white">
            <option value="">Custom item (type below)</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.name} — {money(p.price_cents)}</option>)}
          </select>
          <input value={r.title} onChange={e => update(i, { title: e.target.value })} placeholder="Item name" className="w-full border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm" />
          <div className="flex gap-2">
            <input value={r.quantity} onChange={e => changeQty(i, e.target.value)} inputMode="numeric" aria-label="Quantity" className="w-20 border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm" />
            <input value={r.price} onChange={e => update(i, { price: e.target.value })} inputMode="decimal" placeholder="Total price $" aria-label="Total price" className="flex-1 border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm" />
            {rows.length > 1 && (
              <button type="button" onClick={() => setRows(prev => prev.filter((_, idx) => idx !== i))} className="text-xs font-semibold text-ember">Remove</button>
            )}
          </div>
          <label className="flex items-center gap-2 text-xs text-[#1E3A5F] cursor-pointer">
            <input type="checkbox" className="w-4 h-4" checked={!!r.taxExempt} onChange={e => update(i, { taxExempt: e.target.checked })} />
            <span>No sales tax on this item</span>
          </label>
        </div>
      ))}

      <button type="button" onClick={() => setRows(prev => [...prev, blank()])} className="text-xs font-semibold text-[#1E3A5F] underline mt-3">+ Another item</button>

      <div className="mt-3 bg-cream rounded-md px-3 py-2 text-sm text-[#1E3A5F]">
        Adding <strong>{money(addedCents)}</strong>. New order total: <strong>{money(currentTotalCents + addedCents)}</strong> (was {money(currentTotalCents)})
      </div>

      <label className="flex items-center gap-3 mt-3 text-sm text-[#1E3A5F] cursor-pointer">
        <input type="checkbox" className="w-5 h-5" checked={sendEmail} onChange={e => setSendEmail(e.target.checked)} />
        <span>Email the customer what was added, the new total, and the updated invoice</span>
      </label>

      {error && <p className="text-xs text-ember mt-2">{error}</p>}
      <div className="flex gap-3 items-center mt-3">
        <AdminButton type="button" onClick={submit} disabled={loading || filled.length === 0}>
          {loading ? "Adding..." : "Add to order"}
        </AdminButton>
        <button type="button" onClick={() => { setOpen(false); setError(""); }} className="text-sm text-[#1E3A5F]/70 underline">Cancel</button>
      </div>
    </div>
  );
}
