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

// A part name is still stored (the database column requires one), but
// you never have to type it — if left blank, a sensible name is filled
// in automatically at save time, using the row's position.
export function withAutoNames(rows: BOMPartRow[]): BOMPartRow[] {
  return rows.map((r, i) => ({ ...r, partName: r.partName.trim() || `Part ${i + 1}` }));
}

// Only shows Length, Quantity, and Trim, per your request — material
// and grain direction are still stored (defaulted to "Cedar" and empty)
// since the database keeps a place for them, but nothing about them is
// shown or required here anymore.
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
        Parts used — length, quantity, and trim
      </div>

      {rows.map((row, i) => (
        <div key={i} className="grid grid-cols-12 gap-2 mb-1.5 items-center">
          <input
            type="number"
            value={row.length}
            onChange={e => updateRow(i, { length: e.target.value })}
            placeholder="Length (in)"
            className="col-span-5 border border-[#1E3A5F]/15 rounded-md px-2 py-1.5 text-sm"
          />
          <input
            type="number"
            value={row.quantityPerUnit}
            onChange={e => updateRow(i, { quantityPerUnit: e.target.value })}
            placeholder="Qty"
            className="col-span-3 border border-[#1E3A5F]/15 rounded-md px-2 py-1.5 text-sm"
          />
          <label className="col-span-3 flex items-center gap-1.5 text-xs text-[#1E3A5F]/70">
            <input type="checkbox" checked={row.isTrim} onChange={e => updateRow(i, { isTrim: e.target.checked })} />
            Trim
          </label>
          <button onClick={() => onChange(rows.filter((_, ri) => ri !== i))} className="col-span-1 text-ember text-sm font-semibold">✕</button>
        </div>
      ))}

      <AdminButton size="sm" variant="secondary" onClick={() => onChange([...rows, emptyPartRow()])}>+ Add part</AdminButton>
    </div>
  );
}
