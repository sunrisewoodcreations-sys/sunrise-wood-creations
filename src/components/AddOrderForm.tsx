"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const PRODUCT_TYPES = [
  { value: "cornhole", label: "Cornhole boards" },
  { value: "sign", label: "Wooden sign" },
  { value: "planter", label: "Planter box" },
  { value: "cutting_board", label: "Cutting board" }
];

export default function AddOrderForm({ customerId }: { customerId: string }) {
  const router = useRouter();
  const [productType, setProductType] = useState("cornhole");
  const [title, setTitle] = useState("");
  const [sizeDetails, setSizeDetails] = useState("");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId, productType, title, sizeDetails, priceCents: price, quantity })
      });

      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(body.error || `Something went wrong (status ${res.status}).`);
        setLoading(false);
        return;
      }

      setLoading(false);
      setTitle(""); setSizeDetails(""); setPrice(""); setQuantity("1");
      setOpen(false);
      router.refresh();
    } catch (err) {
      setLoading(false);
      setError("Couldn't reach the server. Check your connection and try again.");
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="bg-black text-cream px-4 py-2 rounded-md text-sm font-semibold mb-5">
        + Add order
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-black/10 rounded-xl p-5 mb-6 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-black mb-1">Product type</label>
          <select value={productType} onChange={e => setProductType(e.target.value)} className="w-full border border-black/15 rounded-md px-3 py-2 text-sm">
            {PRODUCT_TYPES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-black mb-1">Order title / description</label>
          <input required value={title} onChange={e => setTitle(e.target.value)} placeholder="Michigan flag design" className="w-full border border-black/15 rounded-md px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-black mb-1">Size / details</label>
          <input value={sizeDetails} onChange={e => setSizeDetails(e.target.value)} placeholder="24in x 48in, 2 boards" className="w-full border border-black/15 rounded-md px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-black mb-1">Price ($)</label>
          <input value={price} onChange={e => setPrice(e.target.value)} placeholder="225" className="w-full border border-black/15 rounded-md px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-black mb-1">Qty</label>
          <input type="number" min="1" value={quantity} onChange={e => setQuantity(e.target.value)} className="w-full border border-black/15 rounded-md px-3 py-2 text-sm" />
        </div>
      </div>
      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={loading} className="bg-ember text-white px-4 py-2 rounded-md text-sm font-semibold disabled:opacity-60">
          {loading ? "Creating..." : "Create order"}
        </button>
        <button type="button" onClick={() => { setOpen(false); setError(""); }} className="border border-black text-black px-4 py-2 rounded-md text-sm font-semibold">
          Cancel
        </button>
      </div>
    </form>
  );
}
