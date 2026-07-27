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

// Mobile card version of ProductRow — same editing, saving, deleting,
// and duplicating behavior (shared via useProductEditor, not a second
// copy of that logic), laid out as a stacked card with large touch
// targets instead of a table row, since a table row can't reasonably
// fit or be tapped accurately on a phone screen.
export default function ProductCardMobile({
  product, buildableNow, reservedQty, unitsSold, bomParts
}: {
  product: Product; buildableNow?: number | null; reservedQty?: number; unitsSold?: number;
  bomParts?: BOMPartsInput;
}) {
  const e = useProductEditor(product, bomParts);

  if (e.editing) {
    return (
      <div className="bg-white border-2 border-[#1E3A5F]/30 rounded-xl shadow-sm p-4">
        <div className="text-xs font-semibold text-[#1E3A5F]/50 uppercase tracking-wide mb-3">Editing product</div>

        <div className="space-y-3 mb-4">
          <div>
            <label className="block text-xs font-semibold text-[#1E3A5F]/60 mb-1">Name</label>
            <input value={e.name} onChange={ev => e.setName(ev.target.value)} className="w-full border border-[#1E3A5F]/15 rounded-md px-3 py-2.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#1E3A5F]/60 mb-1">Type</label>
            <select value={e.productType} onChange={ev => e.setProductType(ev.target.value)} className="w-full border border-[#1E3A5F]/15 rounded-md px-3 py-2.5 text-sm">
              {PRODUCT_TYPES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#1E3A5F]/60 mb-1">Size / details</label>
            <input value={e.sizeDetails} onChange={ev => e.setSizeDetails(ev.target.value)} className="w-full border border-[#1E3A5F]/15 rounded-md px-3 py-2.5 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#1E3A5F]/60 mb-1">Price ($)</label>
              <input value={e.price} onChange={ev => e.setPrice(ev.target.value)} className="w-full border border-[#1E3A5F]/15 rounded-md px-3 py-2.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#1E3A5F]/60 mb-1">Cost ($)</label>
              <input value={e.costPrice} onChange={ev => e.setCostPrice(ev.target.value)} className="w-full border border-[#1E3A5F]/15 rounded-md px-3 py-2.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#1E3A5F]/60 mb-1">Stock</label>
              <input value={e.stockQuantity} onChange={ev => e.setStockQuantity(ev.target.value)} className="w-full border border-[#1E3A5F]/15 rounded-md px-3 py-2.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#1E3A5F]/60 mb-1">Low stock alert at</label>
              <input value={e.lowStockThreshold} onChange={ev => e.setLowStockThreshold(ev.target.value)} className="w-full border border-[#1E3A5F]/15 rounded-md px-3 py-2.5 text-sm" />
            </div>
          </div>
          {e.productType === "planter" && (
            <div>
              <label className="block text-xs font-semibold text-[#1E3A5F]/60 mb-1">Pickets per item</label>
              <input value={e.picketsPerUnit} onChange={ev => e.setPicketsPerUnit(ev.target.value)} className="w-full border border-[#1E3A5F]/15 rounded-md px-3 py-2.5 text-sm" />
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-[#1E3A5F]/60 mb-1">Estimated build time (minutes)</label>
            <input value={e.estimatedBuildMinutes} onChange={ev => e.setEstimatedBuildMinutes(ev.target.value)} placeholder="60" className="w-full border border-[#1E3A5F]/15 rounded-md px-3 py-2.5 text-sm" />
            <p className="text-[10px] text-[#1E3A5F]/40 mt-1">Active labor only — not glue drying or other curing time.</p>
          </div>
        </div>

        <ProductBOMEditor rows={e.partRows} onChange={e.setPartRows} />

        {e.error && <div className="text-ember text-sm mt-3">{e.error}</div>}

        <div className="flex gap-2 mt-4">
          <button
            onClick={e.handleSave}
            disabled={e.loading}
            className="flex-1 bg-[#1E3A5F] text-white rounded-md px-4 py-3 text-sm font-semibold disabled:opacity-60"
          >
            {e.loading ? "Saving..." : "Save"}
          </button>
          <button
            onClick={() => e.setEditing(false)}
            className="flex-1 border border-[#1E3A5F]/20 text-[#1E3A5F] rounded-md px-4 py-3 text-sm font-semibold"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-[#1E3A5F]/10 rounded-xl shadow-sm p-4">
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="text-base font-bold text-[#1E3A5F]">{product.name}</div>
          <div className="text-xs text-[#1E3A5F]/60">
            {productLabel(product.product_type as ProductType)}{product.size_details ? ` · ${product.size_details}` : ""}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-sm font-bold text-[#1E3A5F]">{product.stock_quantity ?? 0} in stock</span>
          <StockStatusBadge quantity={product.stock_quantity ?? 0} threshold={product.low_stock_threshold ?? 0} compact />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-[#1E3A5F]/10 text-sm">
        <div>
          <div className="text-[10px] text-[#1E3A5F]/50 uppercase font-semibold">Price</div>
          <div className="text-[#1E3A5F]/70">${(product.price_cents / 100).toFixed(2)}</div>
        </div>
        <div>
          <div className="text-[10px] text-[#1E3A5F]/50 uppercase font-semibold">Margin</div>
          <div className={e.margin >= 0 ? "text-sage font-semibold" : "text-ember font-semibold"}>${e.margin.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-[10px] text-[#1E3A5F]/50 uppercase font-semibold">Sold</div>
          <div className="text-[#1E3A5F]/70">{unitsSold ?? 0}</div>
        </div>
      </div>

      {((reservedQty ?? 0) > 0 || buildableNow != null || product.estimated_build_minutes != null) && (
        <div className="grid grid-cols-2 gap-2 pt-2 mt-2 border-t border-[#1E3A5F]/10 text-sm">
          {(reservedQty ?? 0) > 0 && (
            <div>
              <div className="text-[10px] text-[#1E3A5F]/50 uppercase font-semibold">Reserved</div>
              <div className="text-amber font-semibold">{reservedQty} (open orders)</div>
            </div>
          )}
          {buildableNow != null && (
            <div>
              <div className="text-[10px] text-[#1E3A5F]/50 uppercase font-semibold">Buildable now</div>
              <div className="text-[#1E3A5F] font-semibold">{buildableNow} from pickets on hand</div>
            </div>
          )}
          {product.estimated_build_minutes != null && (
            <div>
              <div className="text-[10px] text-[#1E3A5F]/50 uppercase font-semibold">Build time</div>
              <div className="text-[#1E3A5F] font-semibold">
                {product.estimated_build_minutes >= 60
                  ? `${(product.estimated_build_minutes / 60).toFixed(product.estimated_build_minutes % 60 === 0 ? 0 : 1)}h`
                  : `${product.estimated_build_minutes}m`}
              </div>
            </div>
          )}
        </div>
      )}

      {e.confirmingDelete ? (
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[#1E3A5F]/10">
          <span className="text-sm text-[#1E3A5F]/70 flex-1">Delete this product?</span>
          <button
            onClick={e.handleDelete}
            disabled={e.loading}
            className="bg-ember text-white rounded-md px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
          >
            {e.loading ? "..." : "Confirm"}
          </button>
          <button
            onClick={() => e.setConfirmingDelete(false)}
            className="border border-[#1E3A5F]/20 text-[#1E3A5F] rounded-md px-4 py-2.5 text-sm font-semibold"
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className="flex gap-2 mt-3 pt-3 border-t border-[#1E3A5F]/10">
          <button
            onClick={() => e.setEditing(true)}
            className="flex-1 bg-[#1E3A5F] text-white rounded-md px-3 py-2.5 text-sm font-semibold"
          >
            Edit
          </button>
          <button
            onClick={e.handleDuplicate}
            disabled={e.duplicating}
            className="flex-1 border border-[#1E3A5F]/20 text-[#1E3A5F] rounded-md px-3 py-2.5 text-sm font-semibold disabled:opacity-60"
          >
            {e.duplicating ? "..." : "Duplicate"}
          </button>
          <button
            onClick={() => e.setConfirmingDelete(true)}
            className="border border-ember/30 text-ember rounded-md px-3 py-2.5 text-sm font-semibold"
          >
            Delete
          </button>
        </div>
      )}
      {e.error && !e.editing && <div className="text-ember text-xs mt-2">{e.error}</div>}
    </div>
  );
}
