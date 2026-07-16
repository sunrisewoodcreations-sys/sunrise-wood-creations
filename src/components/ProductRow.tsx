"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { productLabel, ProductType } from "@/lib/statusSteps";

const PRODUCT_TYPES = [
  { value: "cornhole", label: "Cornhole boards" },
  { value: "sign", label: "Wooden sign" },
  { value: "planter", label: "Planter box" },
  { value: "cutting_board", label: "Cutting board" }
];

type Product = {
  id: string;
  product_type: string;
  name: string;
  size_details: string | null;
  price_cents: number;
  cost_cents: number;
  stock_quantity: number;
  low_stock_threshold: number;
  pickets_per_unit: number;
};

export default function ProductRow({
  product, buildableNow, reservedQty, unitsSold
}: { product: Product; buildableNow?: number | null; reservedQty?: number; unitsSold?: number }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [productType, setProductType] = useState(product.product_type);
  const [name, setName] = useState(product.name);
  const [sizeDetails, setSizeDetails] = useState(product.size_details || "");
  const [price, setPrice] = useState((product.price_cents / 100).toString());
  const [costPrice, setCostPrice] = useState(((product.cost_cents ?? 0) / 100).toString());
  const [stockQuantity, setStockQuantity] = useState(String(product.stock_quantity ?? 0));
  const [lowStockThreshold, setLowStockThreshold] = useState(String(product.low_stock_threshold ?? 0));
  const [picketsPerUnit, setPicketsPerUnit] = useState(String(product.pickets_per_unit ?? 0));
  const [adjustmentReason, setAdjustmentReason] = useState("");

  const margin = (product.price_cents - (product.cost_cents || 0)) / 100;
  const stockWillChange = Number(stockQuantity) !== (product.stock_quantity ?? 0);

  async function handleSave() {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/products/${product.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productType, name, sizeDetails, priceCents: price, costCents: costPrice, stockQuantity, lowStockThreshold, picketsPerUnit, adjustmentReason })
    });
    setLoading(false);
    if (res.ok) {
      setEditing(false);
      setAdjustmentReason("");
      router.refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Couldn't save changes.");
    }
  }

  async function handleDelete() {
    setLoading(true);
    const res = await fetch(`/api/products/${product.id}`, { method: "DELETE" });
    setLoading(false);
    if (res.ok) router.refresh();
  }

  if (editing) {
    return (
      <>
      <tr className="border-t border-[#1E3A5F]/10 bg-cream/40">
        <td className="px-4 py-3">
          <input value={name} onChange={e => setName(e.target.value)} className="w-full border border-[#1E3A5F]/15 rounded-md px-2 py-1 text-sm" />
        </td>
        <td className="px-4 py-3">
          <select value={productType} onChange={e => setProductType(e.target.value)} className="w-full border border-[#1E3A5F]/15 rounded-md px-2 py-1 text-sm">
            {PRODUCT_TYPES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </td>
        <td className="px-4 py-3">
          <input value={sizeDetails} onChange={e => setSizeDetails(e.target.value)} className="w-full border border-[#1E3A5F]/15 rounded-md px-2 py-1 text-sm" />
        </td>
        <td className="px-4 py-3 text-right">
          <input value={price} onChange={e => setPrice(e.target.value)} className="w-20 border border-[#1E3A5F]/15 rounded-md px-2 py-1 text-sm text-right" />
        </td>
        <td className="px-4 py-3 text-right">
          <input value={costPrice} onChange={e => setCostPrice(e.target.value)} className="w-20 border border-[#1E3A5F]/15 rounded-md px-2 py-1 text-sm text-right" />
        </td>
        <td className="px-4 py-3 text-right text-[#1E3A5F]/40">—</td>
        <td className="px-4 py-3 text-right">
          <input value={stockQuantity} onChange={e => setStockQuantity(e.target.value)} className="w-16 border border-[#1E3A5F]/15 rounded-md px-2 py-1 text-sm text-right" />
        </td>
        <td className="px-4 py-3 text-right">
          <input value={lowStockThreshold} onChange={e => setLowStockThreshold(e.target.value)} className="w-16 border border-[#1E3A5F]/15 rounded-md px-2 py-1 text-sm text-right" />
        </td>
        <td className="px-4 py-3 text-right">
          {productType === "planter" ? (
            <input value={picketsPerUnit} onChange={e => setPicketsPerUnit(e.target.value)} className="w-16 border border-[#1E3A5F]/15 rounded-md px-2 py-1 text-sm text-right" />
          ) : (
            <span className="text-[#1E3A5F]/30">—</span>
          )}
        </td>
        <td className="px-4 py-3 text-right text-[#1E3A5F]/30">—</td>
        <td className="px-4 py-3 text-right text-[#1E3A5F]/30">—</td>
        <td className="px-4 py-3 text-right text-[#1E3A5F]/30">—</td>
        <td className="px-4 py-3 text-right whitespace-nowrap">
          <button onClick={handleSave} disabled={loading} className="text-sage font-semibold text-xs mr-3">
            {loading ? "Saving..." : "Save"}
          </button>
          <button onClick={() => setEditing(false)} className="text-[#1E3A5F]/50 text-xs">Cancel</button>
          {error && <div className="text-ember text-xs mt-1">{error}</div>}
        </td>
      </tr>
      {stockWillChange && (
        <tr className="bg-cream/40">
          <td colSpan={13} className="px-4 pb-3">
            <label className="block text-[11px] font-semibold text-[#1E3A5F] mb-1">
              Reason for stock change ({product.stock_quantity ?? 0} → {stockQuantity})
            </label>
            <input
              value={adjustmentReason}
              onChange={e => setAdjustmentReason(e.target.value)}
              placeholder="e.g. Restocked, corrected count, damaged goods"
              className="w-full border border-[#1E3A5F]/15 rounded-md px-2 py-1.5 text-sm"
            />
          </td>
        </tr>
      )}
      </>
    );
  }

  const isLowStock = (product.stock_quantity ?? 0) <= (product.low_stock_threshold ?? 0);

  return (
    <tr className="border-t border-[#1E3A5F]/10">
      <td className="px-4 py-3 text-[#1E3A5F]/70">{product.name}</td>
      <td className="px-4 py-3 text-[#1E3A5F]/70">{productLabel(product.product_type as ProductType)}</td>
      <td className="px-4 py-3 text-[#1E3A5F]/70">{product.size_details || "—"}</td>
      <td className="px-4 py-3 text-right text-[#1E3A5F]/70">${(product.price_cents / 100).toFixed(2)}</td>
      <td className="px-4 py-3 text-right text-[#1E3A5F]/70">${((product.cost_cents ?? 0) / 100).toFixed(2)}</td>
      <td className={`px-4 py-3 text-right font-semibold ${margin >= 0 ? "text-sage" : "text-ember"}`}>
        ${margin.toFixed(2)}
      </td>
      <td className={`px-4 py-3 text-right font-semibold ${isLowStock ? "text-ember" : "text-sage"}`}>
        {product.stock_quantity ?? 0}
      </td>
      <td className="px-4 py-3 text-right text-[#1E3A5F]/50">{product.low_stock_threshold ?? 0}</td>
      <td className="px-4 py-3 text-right text-[#1E3A5F]/50">
        {product.product_type === "planter" ? (product.pickets_per_unit ?? 0) : "—"}
      </td>
      <td className="px-4 py-3 text-right font-semibold text-[#1E3A5F]">
        {buildableNow != null ? buildableNow : "—"}
      </td>
      <td className={`px-4 py-3 text-right font-semibold ${(reservedQty ?? 0) > 0 ? "text-amber" : "text-[#1E3A5F]/30"}`}>
        {reservedQty ?? 0}
      </td>
      <td className="px-4 py-3 text-right text-[#1E3A5F]/70">
        {unitsSold ?? 0}
      </td>
      <td className="px-4 py-3 text-right whitespace-nowrap">
        {confirmingDelete ? (
          <>
            <button onClick={handleDelete} disabled={loading} className="text-ember font-semibold text-xs mr-2">
              {loading ? "Deleting..." : "Confirm"}
            </button>
            <button onClick={() => setConfirmingDelete(false)} className="text-[#1E3A5F]/50 text-xs">Cancel</button>
          </>
        ) : (
          <>
            <button onClick={() => setEditing(true)} className="text-xs text-[#1E3A5F] hover:underline mr-3">Edit</button>
            <button onClick={() => setConfirmingDelete(true)} className="text-xs text-[#1E3A5F] hover:underline">Delete</button>
          </>
        )}
      </td>
    </tr>
  );
}
