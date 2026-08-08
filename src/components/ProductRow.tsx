"use client";

import { productLabel, ProductType } from "@/lib/statusSteps";
import ProductBOMEditor from "@/components/ProductBOMEditor";
import { useProductEditor, Product, BOMPartsInput } from "@/hooks/useProductEditor";
import StockStatusBadge from "@/components/StockStatusBadge";

const PRODUCT_TYPES = [
  { value: "cornhole", label: "Cornhole boards" },
  { value: "sign", label: "Wooden sign" },
  { value: "planter", label: "Planter box" },
  { value: "cutting_board", label: "Cutting board" }
];

export default function ProductRow({
  product, buildableNow, reservedQty, unitsSold, bomParts
}: {
  product: Product; buildableNow?: number | null; reservedQty?: number; unitsSold?: number;
  bomParts?: BOMPartsInput;
}) {
  const e = useProductEditor(product, bomParts);

  if (e.editing) {
    return (
      <>
      <tr className="border-t border-[#1E3A5F]/10 bg-cream/40">
        <td className="px-4 py-3">
          <input value={e.name} onChange={ev => e.setName(ev.target.value)} className="w-full border border-[#1E3A5F]/15 rounded-md px-2 py-1 text-sm" />
        </td>
        <td className="px-4 py-3">
          <select value={e.productType} onChange={ev => e.setProductType(ev.target.value)} className="w-full border border-[#1E3A5F]/15 rounded-md px-2 py-1 text-sm">
            {PRODUCT_TYPES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </td>
        <td className="px-4 py-3">
          <input value={e.sizeDetails} onChange={ev => e.setSizeDetails(ev.target.value)} className="w-full border border-[#1E3A5F]/15 rounded-md px-2 py-1 text-sm" />
        </td>
        <td className="px-4 py-3 text-right">
          <input value={e.price} onChange={ev => e.setPrice(ev.target.value)} className="w-20 border border-[#1E3A5F]/15 rounded-md px-2 py-1 text-sm text-right" />
        </td>
        <td className="px-4 py-3 text-right">
          <input value={e.costPrice} onChange={ev => e.setCostPrice(ev.target.value)} className="w-20 border border-[#1E3A5F]/15 rounded-md px-2 py-1 text-sm text-right" />
        </td>
        <td className="px-4 py-3 text-right text-[#1E3A5F]/40">—</td>
        <td className="px-4 py-3 text-right">
          <input value={e.stockQuantity} onChange={ev => e.setStockQuantity(ev.target.value)} className="w-16 border border-[#1E3A5F]/15 rounded-md px-2 py-1 text-sm text-right" />
        </td>
        <td className="px-4 py-3 text-right">
          <input value={e.lowStockThreshold} onChange={ev => e.setLowStockThreshold(ev.target.value)} className="w-16 border border-[#1E3A5F]/15 rounded-md px-2 py-1 text-sm text-right" />
        </td>
        <td className="px-4 py-3 text-right">
          {e.productType === "planter" ? (
            <input value={e.picketsPerUnit} onChange={ev => e.setPicketsPerUnit(ev.target.value)} className="w-16 border border-[#1E3A5F]/15 rounded-md px-2 py-1 text-sm text-right" />
          ) : (
            <span className="text-[#1E3A5F]/30">—</span>
          )}
        </td>
        <td className="px-4 py-3 text-right text-[#1E3A5F]/30">—</td>
        <td className="px-4 py-3 text-right text-[#1E3A5F]/30">—</td>
        <td className="px-4 py-3 text-right text-[#1E3A5F]/30">—</td>
        <td className="px-4 py-3 text-right">
          <input
            value={e.estimatedBuildMinutes}
            onChange={ev => e.setEstimatedBuildMinutes(ev.target.value)}
            placeholder="min"
            className="w-16 border border-[#1E3A5F]/15 rounded-md px-2 py-1 text-sm text-right"
          />
        </td>
        <td className="px-4 py-3 text-right whitespace-nowrap">
          <button onClick={e.handleSave} disabled={e.loading} className="text-sage font-semibold text-xs mr-3">
            {e.loading ? "Saving..." : "Save"}
          </button>
          <button onClick={() => e.setEditing(false)} className="text-[#1E3A5F]/50 text-xs">Cancel</button>
          {e.error && <div className="text-ember text-xs mt-1">{e.error}</div>}
        </td>
      </tr>
      <tr className="bg-cream/40">
        <td colSpan={14} className="px-4 pb-3">
          <ProductBOMEditor rows={e.partRows} onChange={e.setPartRows} />
        </td>
      </tr>
      </>
    );
  }

  return (
    <>
    <tr className="border-t border-[#1E3A5F]/10">
      <td className="px-4 py-3 text-[#1E3A5F]/70">{product.name}</td>
      <td className="px-4 py-3 text-[#1E3A5F]/70">{productLabel(product.product_type as ProductType)}</td>
      <td className="px-4 py-3 text-[#1E3A5F]/70">{product.size_details || "—"}</td>
      <td className="px-4 py-3 text-right text-[#1E3A5F]/70">${(product.price_cents / 100).toFixed(2)}</td>
      <td className="px-4 py-3 text-right text-[#1E3A5F]/70">${((product.cost_cents ?? 0) / 100).toFixed(2)}</td>
      <td className={`px-4 py-3 text-right font-semibold ${e.margin >= 0 ? "text-sage" : "text-ember"}`}>
        ${e.margin.toFixed(2)}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-2">
          <span className="font-semibold text-[#1E3A5F]">{product.stock_quantity ?? 0}</span>
          <StockStatusBadge quantity={product.stock_quantity ?? 0} threshold={product.low_stock_threshold ?? 0} compact />
        </div>
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
      <td className="px-4 py-3 text-right">
        {product.estimated_build_minutes != null ? (
          <span className="text-[#1E3A5F]/70">
            {product.estimated_build_minutes >= 60
              ? `${(product.estimated_build_minutes / 60).toFixed(product.estimated_build_minutes % 60 === 0 ? 0 : 1)}h`
              : `${product.estimated_build_minutes}m`}
          </span>
        ) : (
          <span className="text-[#1E3A5F]/30 text-xs italic">Not tracked</span>
        )}
      </td>
      <td className="px-4 py-3 text-right whitespace-nowrap">
        {e.confirmingDelete ? (
          <>
            <button onClick={e.handleDelete} disabled={e.loading} className="text-ember font-semibold text-xs mr-2">
              {e.loading ? "Deleting..." : "Confirm"}
            </button>
            <button onClick={() => e.setConfirmingDelete(false)} className="text-[#1E3A5F]/50 text-xs">Cancel</button>
          </>
        ) : (
          <>
            <button onClick={() => e.setEditing(true)} className="text-xs text-[#1E3A5F] hover:underline mr-3">Edit</button>
            <button onClick={e.handleDuplicate} disabled={e.duplicating} className="text-xs text-[#1E3A5F] hover:underline mr-3 disabled:opacity-50">
              {e.duplicating ? "Duplicating..." : "Duplicate"}
            </button>
            <button onClick={() => e.setConfirmingDelete(true)} className="text-xs text-[#1E3A5F] hover:underline">Delete</button>
          </>
        )}
      </td>
    </tr>
    {e.error && !e.editing && (
      <tr>
        <td colSpan={14} className="px-4 pb-2 text-xs text-ember">{e.error}</td>
      </tr>
    )}
    </>
  );
}
