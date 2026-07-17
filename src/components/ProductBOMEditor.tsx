"use client";

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

export function emptyPartRow(): BOMPartRow {
  return { partName: "", length: "", finalLength: "", quantityPerUnit: "1", materialType: "Cedar", isTrim: false, grainDirection: "" };
}

export function bomPartsToRows(parts: { part_name: string; length_inches: number; final_length_inches: number | null; quantity_per_unit: number; material_type: string; is_trim: boolean; grain_direction: string | null }[]): BOMPartRow[] {
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
    : [emptyPartRow()];
}

// Purely a controlled display/edit grid now — no state of its own, no
// save button, no API call. The parent (ProductRow) owns the actual
// rows and saves them together with the rest of the product in one
// combined Save action, so there's no longer a second, separate save
// step that part edits could be silently lost by skipping.
export default function ProductBOMEditor({
  rows,
  onChange
}: {
  rows: BOMPartRow[];
  onChange: (rows: BOMPartRow[]) => void;
}) {
  function updateRow(index: number, patch: Partial<BOMPartRow>) {
    onChange(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
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
          <button onClick={() => onChange(rows.filter((_, ri) => ri !== i))} className="col-span-1 text-ember text-xs font-semibold">✕</button>
        </div>
      ))}

      <AdminButton size="sm" variant="secondary" onClick={() => onChange([...rows, emptyPartRow()])}>+ Add part</AdminButton>
    </div>
  );
}
