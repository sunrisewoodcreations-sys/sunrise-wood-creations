"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AdminButton from "@/components/AdminButton";

const PRODUCT_TYPES = [
  { value: "cornhole", label: "Cornhole boards" },
  { value: "sign", label: "Wooden sign" },
  { value: "planter", label: "Planter box" },
  { value: "cutting_board", label: "Cutting board" }
];

type SavedProduct = { id: string; product_type: string; name: string; size_details: string | null; price_cents: number };

export default function AddOrderForm({ customerId, products = [] }: { customerId: string; products?: SavedProduct[] }) {
  const router = useRouter();
  const [productType, setProductType] = useState("cornhole");
  const [title, setTitle] = useState("");
  const [sizeDetails, setSizeDetails] = useState("");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [unitPriceCents, setUnitPriceCents] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");

  const matchingProducts = products.filter(p => p.product_type === productType);

  // Mirrors the exact same "fill in from a saved product" behavior as
  // AddOrderWithCustomerPicker.tsx on the Orders page.
  function applySavedProduct(productId: string) {
    if (!productId) {
      setSelectedProductId(null);
      setUnitPriceCents(null);
      return;
    }
    const p = products.find(pr => pr.id === productId);
    if (!p) return;
    const qty = Number(quantity) || 1;
    setTitle(p.name);
    setSizeDetails(p.size_details || "");
    setSelectedProductId(p.id);
    setUnitPriceCents(p.price_cents);
    setPrice(((p.price_cents * qty) / 100).toString());
  }

  function handleQuantityChange(newQty: string) {
    setQuantity(newQty);
    if (unitPriceCents != null) {
      const qtyNum = Number(newQty) || 0;
      setPrice(((unitPriceCents * qtyNum) / 100).toString());
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId, productType, title, sizeDetails, priceCents: price, quantity, productId: selectedProductId })
      });

      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(body.error || `Something went wrong (status ${res.status}).`);
        setLoading(false);
        return;
      }

      setLoading(false);
      setTitle(""); setSizeDetails(""); setPrice(""); setQuantity("1");
      setSelectedProductId(null); setUnitPriceCents(null);
      setOpen(false);
      router.refresh();
    } catch (err) {
      setLoading(false);
      setError("Couldn't reach the server. Check your connection and try again.");
    }
  }

  if (!open) {
    return (
      <AdminButton onClick={() => setOpen(true)} className="mb-5">
        + Add order
      </AdminButton>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-[#1E3A5F]/10 rounded-xl p-5 mb-6 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-[#1E3A5F] mb-1">Product type</label>
          <select
            value={productType}
            onChange={e => { setProductType(e.target.value); setSelectedProductId(null); setUnitPriceCents(null); }}
            className="w-full border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm"
          >
            {PRODUCT_TYPES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
        {productType !== "cornhole" && matchingProducts.length > 0 && (
          <div>
            <label className="block text-xs font-semibold text-[#1E3A5F] mb-1">Fill in from saved product</label>
            <select
              value={selectedProductId || ""}
              onChange={e => applySavedProduct(e.target.value)}
              className="w-full border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm"
            >
              <option value="">— Choose —</option>
              {matchingProducts.map(p => (
                <option key={p.id} value={p.id}>{p.name} — ${(p.price_cents / 100).toFixed(2)}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="block text-xs font-semibold text-[#1E3A5F] mb-1">Order title / description</label>
          <input required value={title} onChange={e => setTitle(e.target.value)} placeholder="Michigan flag design" className="w-full border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#1E3A5F] mb-1">Size / details</label>
          <input value={sizeDetails} onChange={e => setSizeDetails(e.target.value)} placeholder="24in x 48in, 2 boards" className="w-full border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#1E3A5F] mb-1">Price ($)</label>
          <input value={price} onChange={e => { setPrice(e.target.value); setUnitPriceCents(null); }} placeholder="225" className="w-full border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#1E3A5F] mb-1">Qty</label>
          <input type="number" min="1" value={quantity} onChange={e => handleQuantityChange(e.target.value)} className="w-full border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm" />
        </div>
      </div>
      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>}
      <div className="flex gap-2">
        <AdminButton type="submit" disabled={loading}>
          {loading ? "Creating..." : "Create order"}
        </AdminButton>
        <AdminButton type="button" variant="secondary" onClick={() => { setOpen(false); setError(""); }}>
          Cancel
        </AdminButton>
      </div>
    </form>
  );
}
