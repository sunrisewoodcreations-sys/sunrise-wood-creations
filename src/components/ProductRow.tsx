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
};

export default function ProductRow({ product }: { product: Product }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [productType, setProductType] = useState(product.product_type);
  const [name, setName] = useState(product.name);
  const [sizeDetails, setSizeDetails] = useState(product.size_details || "");
  const [price, setPrice] = useState((product.price_cents / 100).toString());

  async function handleSave() {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/products/${product.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productType, name, sizeDetails, priceCents: price })
    });
    setLoading(false);
    if (res.ok) {
      setEditing(false);
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
      <tr className="border-t border-walnut/10 bg-cream/40">
        <td className="px-4 py-3">
          <input value={name} onChange={e => setName(e.target.value)} className="w-full border border-walnut/15 rounded-md px-2 py-1 text-sm" />
        </td>
        <td className="px-4 py-3">
          <select value={productType} onChange={e => setProductType(e.target.value)} className="w-full border border-walnut/15 rounded-md px-2 py-1 text-sm">
            {PRODUCT_TYPES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </td>
        <td className="px-4 py-3">
          <input value={sizeDetails} onChange={e => setSizeDetails(e.target.value)} className="w-full border border-walnut/15 rounded-md px-2 py-1 text-sm" />
        </td>
        <td className="px-4 py-3 text-right">
          <input value={price} onChange={e => setPrice(e.target.value)} className="w-20 border border-walnut/15 rounded-md px-2 py-1 text-sm text-right" />
        </td>
        <td className="px-4 py-3 text-right whitespace-nowrap">
          <button onClick={handleSave} disabled={loading} className="text-sage font-semibold text-xs mr-3">
            {loading ? "Saving..." : "Save"}
          </button>
          <button onClick={() => setEditing(false)} className="text-walnut/50 text-xs">Cancel</button>
          {error && <div className="text-ember text-xs mt-1">{error}</div>}
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-walnut/10">
      <td className="px-4 py-3 font-semibold text-walnut">{product.name}</td>
      <td className="px-4 py-3 text-walnut/70">{productLabel(product.product_type as ProductType)}</td>
      <td className="px-4 py-3 text-walnut/70">{product.size_details || "—"}</td>
      <td className="px-4 py-3 text-right text-walnut/70">${(product.price_cents / 100).toFixed(2)}</td>
      <td className="px-4 py-3 text-right whitespace-nowrap">
        {confirmingDelete ? (
          <>
            <button onClick={handleDelete} disabled={loading} className="text-ember font-semibold text-xs mr-2">
              {loading ? "Deleting..." : "Confirm"}
            </button>
            <button onClick={() => setConfirmingDelete(false)} className="text-walnut/50 text-xs">Cancel</button>
          </>
        ) : (
          <>
            <button onClick={() => setEditing(true)} className="text-xs text-walnut hover:underline mr-3">Edit</button>
            <button onClick={() => setConfirmingDelete(true)} className="text-xs text-walnut hover:underline">Delete</button>
          </>
        )}
      </td>
    </tr>
  );
}
