"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import AdminButton from "@/components/AdminButton";

export type BOMPartRow = {
  partName: string;
  length: string;
  finalLength: string;
  quantityPerUnit: string;
  materialType: string;
  isTrim: boolean;
  grainDirection: string;
};

function emptyRow(): BOMPartRow {
  return { partName: "", length: "", finalLength: "", quantityPerUnit: "1", materialType: "Cedar", isTrim: false, grainDirection: "" };
}

function toRows(parts: { part_name: string; length_inches: number; final_length_inches: number | null; quantity_per_unit: number; material_type: string; is_trim: boolean; grain_direction: string | null }[]): BOMPartRow[] {
  return parts.length > 0
    ? parts.map(p => ({
        partName: p.part_name,
        length: String(p.length_inches),
        finalLength: p.final_length_inches != null ? String(p.final_length_inches) : "",
        quantityPerUnit: String(p.quantity_per_unit),
        materialType: p.material_type,
        isTrim: p.is_trim,
        grainDirection: p.grain_direction || ""
      }))
    : [emptyRow()];
}

export default function ProductBOMEditor({
  productId,
  initialParts
}: {
  productId: string;
  initialParts: { part_name: string; length_inches: number; final_length_inches: number | null; quantity_per_unit: number; material_type: string; is_trim: boolean; grain_direction: string | null }[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState<BOMPartRow[]>(() => toRows(initialParts));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  // The root cause of "parts disappear after hide/show": this component
  // used to only read initialParts once, on first mount. If the panel
  // got hidden and shown again before the page's background refresh
  // (triggered by a save) had actually finished, a fresh mount would
  // grab whatever stale data the parent still had. Re-syncing whenever
  // the real server data changes — not just on mount — fixes this at
  // the source instead of relying on timing.
  const initialPartsKey = JSON.stringify(initialParts);
  const lastSyncedKey = useRef(initialPartsKey);
  useEffect(() => {
    if (initialPartsKey !== lastSyncedKey.current) {
      lastSyncedKey.current = initialPartsKey;
      setRows(toRows(initialParts));
    }
  }, [initialPartsKey, initialParts]);

  function updateRow(index: number, patch: Partial<BOMPartRow>) {
    setRows(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  async function handleSave() {
    setLoading(true);
    setError("");
    setSaved(false);

    const validRows = rows.filter(r => r.partName.trim() && Number(r.length) > 0);

    const res = await fetch(`/api/products/${productId}/bom-parts`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        parts: validRows.map(r => ({
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

    setLoading(false);
    if (res.ok) {
      setSaved(true);
      router.refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Couldn't save the parts list.");
    }
  }

  return (
    <div className="bg-cream/40 border border-[#1E3A5F]/10 rounded-lg p-3">
      <div className="text-xs font-semibold text-[#1E3A5F]/70 uppercase tracking-wide mb-2">
        Parts used (Bill of Materials)
      </div>

      {rows.map((row, i) => (
        <div key={i} className="grid grid-cols-12 gap-1.5 mb-1.5 items-center">
          <input
            value={row.partName}
            onChange={e => updateRow(i, { partName: e.target.value })}
            placeholder="Part name"
            className="col-span-3 border border-[#1E3A5F]/15 rounded-md px-2 py-1.5 text-xs"
          />
          <input
            type="number"
            value={row.length}
            onChange={e => updateRow(i, { length: e.target.value })}
            placeholder="Length (in)"
            className="col-span-2 border border-[#1E3A5F]/15 rounded-md px-2 py-1.5 text-xs"
          />
          <input
            type="number"
            value={row.quantityPerUnit}
            onChange={e => updateRow(i, { quantityPerUnit: e.target.value })}
            placeholder="Qty"
            className="col-span-1 border border-[#1E3A5F]/15 rounded-md px-2 py-1.5 text-xs"
          />
          <input
            value={row.materialType}
            onChange={e => updateRow(i, { materialType: e.target.value })}
            placeholder="Material (e.g. Cedar)"
            className="col-span-3 border border-[#1E3A5F]/15 rounded-md px-2 py-1.5 text-xs"
          />
          <select
            value={row.grainDirection}
            onChange={e => updateRow(i, { grainDirection: e.target.value })}
            className="col-span-1 border border-[#1E3A5F]/15 rounded-md px-1 py-1.5 text-xs"
          >
            <option value="">Grain</option>
            <option value="length">Length</option>
            <option value="width">Width</option>
            <option value="either">Either</option>
          </select>
          <label className="col-span-1 flex items-center gap-1 text-[11px] text-[#1E3A5F]/70">
            <input type="checkbox" checked={row.isTrim} onChange={e => updateRow(i, { isTrim: e.target.checked })} />
            Trim
          </label>
          <button onClick={() => setRows(rows.filter((_, ri) => ri !== i))} className="col-span-1 text-ember text-xs font-semibold">✕</button>
        </div>
      ))}

      {error && <p className="text-xs text-ember mb-2">{error}</p>}

      <div className="flex items-center gap-2 mt-2">
        <AdminButton size="sm" variant="secondary" onClick={() => setRows([...rows, emptyRow()])}>+ Add part</AdminButton>
        <AdminButton size="sm" onClick={handleSave} disabled={loading}>{loading ? "Saving..." : "Save parts list"}</AdminButton>
        {saved && <span className="text-xs font-semibold text-sage">Saved</span>}
      </div>
    </div>
  );
}
