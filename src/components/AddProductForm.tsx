"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AdminButton from "@/components/AdminButton";
import ProductBOMEditor, { BOMPartRow, emptyPartRow, withAutoNames } from "@/components/ProductBOMEditor";

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
  const [picketsPerUnit, setPicketsPerUnit] = useState("0");
  const [estimatedBuildMinutes, setEstimatedBuildMinutes] = useState("");
  const [partRows, setPartRows] = useState<BOMPartRow[]>([emptyPartRow()]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productType, name, sizeDetails, priceCents: price, costCents: costPrice, stockQuantity, lowStockThreshold, picketsPerUnit, estimatedBuildMinutes })
    });
    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      setLoading(false);
      setError(body.error || "Something went wrong.");
      return;
    }

    // Parts need the new product's ID, so this step can only happen
    // after the product itself is created — not in parallel.
    const validPartRows = withAutoNames(partRows.filter(r => Number(r.length) > 0));
    if (validPartRows.length > 0) {
      const partsRes = await fetch(`/api/products/${body.product.id}/bom-parts`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parts: validPartRows.map(r => ({
            partName: r.partName,
            length: r.length,
            finalLength: r.finalLength || undefined,
            quantityPerUnit: r.quantityPerUnit,
            materialType: r.materialType,
            isTrim: r.isTrim,
            grainDirection: r.grainDirection || undefined
          }))
        })
      });
      if (!partsRes.ok) {
        setLoading(false);
        const partsBody = await partsRes.json().catch(() => ({}));
        setError(`Product was created, but saving its parts failed: ${partsBody.error || "unknown error"}. Edit the product to add them.`);
        setOpen(false);
        router.refresh();
        return;
      }
    }

    setLoading(false);
    setName(""); setSizeDetails(""); setPrice(""); setCostPrice(""); setStockQuantity("0"); setLowStockThreshold("0"); setPicketsPerUnit("0"); setEstimatedBuildMinutes("");
    setPartRows([emptyPartRow()]);
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <AdminButton onClick={() => setOpen(true)} className="mb-5">
        + Add product
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
            onChange={e => {
              const newType = e.target.value;
              setProductType(newType);
              if (newType === "planter" && !estimatedBuildMinutes.trim()) setEstimatedBuildMinutes("60");
            }}
            className="w-full border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm"
          >
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
        <div>
          <label className="block text-xs font-semibold text-[#1E3A5F] mb-1">Estimated build time (minutes)</label>
          <input value={estimatedBuildMinutes} onChange={e => setEstimatedBuildMinutes(e.target.value)} placeholder="60" className="w-full border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm" />
          <p className="text-[10px] text-[#1E3A5F]/40 mt-1">Active labor only — don't include glue drying or other curing time.</p>
        </div>
        {productType === "planter" && (
          <div>
            <label className="block text-xs font-semibold text-[#1E3A5F] mb-1">Pickets used per item</label>
            <input value={picketsPerUnit} onChange={e => setPicketsPerUnit(e.target.value)} placeholder="5" className="w-full border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm" />
            <p className="text-[10px] text-[#1E3A5F]/40 mt-1">Orders using this product auto-log and cost this many pickets — no manual entry needed.</p>
          </div>
        )}
      </div>

      <div className="border-t border-[#1E3A5F]/10 pt-3">
        <ProductBOMEditor rows={partRows} onChange={setPartRows} />
      </div>

      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>}
      <div className="flex gap-2">
        <AdminButton type="submit" disabled={loading}>
          {loading ? "Creating..." : "Create product"}
        </AdminButton>
        <AdminButton type="button" variant="secondary" onClick={() => { setOpen(false); setError(""); }}>
          Cancel
        </AdminButton>
      </div>
    </form>
  );
}
