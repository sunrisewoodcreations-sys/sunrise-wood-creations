"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const PRODUCT_TYPES = [
  { value: "cornhole", label: "Cornhole boards" },
  { value: "sign", label: "Wooden sign" },
  { value: "planter", label: "Planter box" },
  { value: "cutting_board", label: "Cutting board" }
];

export default function AddProductForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [productType, setProductType] = useState("cornhole");
  const [name, setName] = useState("");
  const [sizeDetails, setSizeDetails] = useState("");
  const [price, setPrice] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [stockQuantity, setStockQuantity] = useState("0");
  const [lowStockThreshold, setLowStockThreshold] = useState("0");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productType, name, sizeDetails, priceCents: price, costCents: costPrice, stockQuantity, lowStockThreshold })
    });
    const body = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setError(body.error || "Something went wrong.");
      return;
    }

    setName(""); setSizeDetails(""); setPrice(""); setCostPrice(""); setStockQuantity("0"); setLowStockThreshold("0");
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="bg-[#1E3A5F] text-white px-4 py-2 rounded-md text-sm font-semibold mb-5">
        + Add product
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-[#1E3A5F]/10 rounded-xl p-5 mb-6 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-[#1E3A5F] mb-1">Product type</label>
          <select value={productType} onChange={e => setProductType(e.target.value)} className="w-full border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm">
            {PRODUCT_TYPES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#1E3A5F] mb-1">Name</label>
          <input required value={name} onChange={e => setName(e.target.value)} placeholder="36x18x18 Cedar planter box" className="w-full border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#1E3A5F] mb-1">Size / details</label>
          <input value={sizeDetails} onChange={e => setSizeDetails(e.target.value)} placeholder="36in x 18in x 18in" className="w-full border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#1E3A5F] mb-1">Price ($)</label>
          <input value={price} onChange={e => setPrice(e.target.value)} placeholder="55" className="w-full border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#1E3A5F] mb-1">Your cost ($)</label>
          <input value={costPrice} onChange={e => setCostPrice(e.target.value)} placeholder="20" className="w-full border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#1E3A5F] mb-1">Stock on hand</label>
          <input value={stockQuantity} onChange={e => setStockQuantity(e.target.value)} placeholder="0" className="w-full border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#1E3A5F] mb-1">Low stock alert at</label>
          <input value={lowStockThreshold} onChange={e => setLowStockThreshold(e.target.value)} placeholder="2" className="w-full border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm" />
        </div>
      </div>
      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={loading} className="bg-ember text-white px-4 py-2 rounded-md text-sm font-semibold disabled:opacity-60">
          {loading ? "Creating..." : "Create product"}
        </button>
        <button type="button" onClick={() => { setOpen(false); setError(""); }} className="border border-[#1E3A5F] text-[#1E3A5F] px-4 py-2 rounded-md text-sm font-semibold">
          Cancel
        </button>
      </div>
    </form>
  );
}
