"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { optimizeByMaterial, groupIdenticalBoards, mergeParts, OptimizationResult, BOMPart } from "@/lib/cutlistOptimizer";
import CutDiagram from "@/components/CutDiagram";
import AdminButton from "@/components/AdminButton";

type Mode = "today" | "tomorrow" | "day" | "manual" | "saved";

type Job = { orderId: string; orderTitle: string; customerName: string; productId: string | null; productName: string | null; quantity: number; orderedQuantity?: number; hasBOM: boolean; productionStatus: string; orderStatus: string };
type BOMPartRow = { part_name: string; length_inches: number; final_length_inches: number | null; quantity_per_unit: number; material_type: string; is_trim: boolean };

function toBOMPart(row: BOMPartRow): BOMPart {
  return {
    partName: row.part_name,
    length: row.length_inches,
    finalLength: row.final_length_inches ?? undefined,
    quantityPerUnit: row.quantity_per_unit,
    materialType: row.material_type,
    isTrim: row.is_trim
  };
}

export default function CutListGenerator({
  bomReadyProducts,
  bomPartsByProduct,
  todayJobs,
  tomorrowJobs,
  jobsByDate,
  todayStr,
  savedCutLists
}: {
  bomReadyProducts: { id: string; name: string }[];
  bomPartsByProduct: Record<string, BOMPartRow[]>;
  todayJobs: Job[];
  tomorrowJobs: Job[];
  jobsByDate: Record<string, Job[]>;
  todayStr: string;
  savedCutLists: { id: string; name: string; created_at: string; board_length: number; kerf: number; result_json: any }[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("today");
  const [boardLength, setBoardLength] = useState(71);
  const [kerf, setKerf] = useState(0.125);
  // Default the date picker to the day after tomorrow.
  const [pickedDate, setPickedDate] = useState(() => {
    const d = new Date(todayStr + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + 2);
    return d.toISOString().slice(0, 10);
  });
  const pickedJobs = jobsByDate[pickedDate] || [];
  const pickedLabel = pickedDate
    ? new Date(pickedDate + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })
    : "";
  const [manualRows, setManualRows] = useState<{ productId: string; qty: string }[]>([
    { productId: bomReadyProducts[0]?.id || "", qty: "1" }
  ]);
  // Finished products this cut list makes — saved with it so the Home Screen can offer "Add to stock".
  const [genItems, setGenItems] = useState<{ productId: string; name: string; quantity: number; orderId?: string; customerName?: string; orderTitle?: string }[]>([]);
  const [autoSent, setAutoSent] = useState(false);
  const [generated, setGenerated] = useState<{ generatedKey?: string; jobSig?: string[]; normalResults: OptimizationResult[]; trimResults: OptimizationResult[]; label: string } | null>(null);
  const [generationError, setGenerationError] = useState("");
  const [listName, setListName] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const tomorrowStr = (() => { const d = new Date(todayStr + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); })();

  // A day's cut list that was already generated for these same orders: view it
  // instead of generating again. Orders added later make it generate-able again.
  function alreadyGenerated(dateKey: string, jobs: Job[]) {
    const live = jobs.filter(j => j.quantity > 0);
    if (live.length === 0) return null;
    return savedCutLists.find(l => {
      const r = l.result_json;
      if (r?.generatedKey !== `orders:${dateKey}` || !Array.isArray(r.jobSig)) return false;
      return live.every(j => r.jobSig.includes(`${j.orderId}:${j.productId}`));
    }) || null;
  }

  function GenerateOrView({ dateKey, jobs, label, buttonText }: { dateKey: string; jobs: Job[]; label: string; buttonText: string }) {
    const done = alreadyGenerated(dateKey, jobs);
    if (done) {
      return (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold text-sage">✓ Already generated for these orders.</span>
          <AdminButton variant="secondary" onClick={() => openSaved(done)}>View cut list</AdminButton>
        </div>
      );
    }
    return <AdminButton onClick={() => generateFromJobs(jobs, label, dateKey)} disabled={jobs.length === 0}>{buttonText}</AdminButton>;
  }

  async function generateFromJobs(allJobs: Job[], label: string, dateKey: string) {
    const jobs = allJobs.filter(j => j.quantity > 0);
    if (allJobs.length > 0 && jobs.length === 0) {
      setGenerationError("Nothing to build for these orders — their pieces are already set aside from stock.");
      return;
    }
    const missing = jobs.filter(j => !j.hasBOM);
    if (missing.length > 0) {
      setGenerationError(`${missing.length} order(s) don't have a parts list defined yet (e.g. ${missing[0].productName || missing[0].orderTitle}). Add parts to that product on the Products page first.`);
      return;
    }
    if (jobs.length === 0) {
      setGenerationError("No planter orders scheduled for this day.");
      return;
    }
    const partLists = jobs.map(j => {
      const parts = (bomPartsByProduct[j.productId!] || []).map(toBOMPart);
      return parts.map(p => ({ ...p, quantityPerUnit: p.quantityPerUnit * j.quantity }));
    });
    runOptimization(mergeParts(partLists), label, jobs.map(j => ({ productId: j.productId!, name: j.productName || "Product", quantity: j.quantity, orderId: j.orderId, customerName: j.customerName || undefined, orderTitle: j.orderTitle })), { generatedKey: `orders:${dateKey}`, jobSig: jobs.map(j => `${j.orderId}:${j.productId}`) });

    // Generating a real cut list means production is starting on these
    // orders — mark each one Building, same status the Production
    // Schedule page uses, via the same existing route (no new logic).
    // Skip any order that's already further along (Ready for Pickup or
    // Completed) so re-generating a list doesn't regress finished work
    // back to "Building". Manual Selection has no real orders behind
    // it, so this only ever applies to Today's/Tomorrow's.
    const orderIdsToMark = [...new Set(
      jobs.filter(j => !["ready_for_pickup", "completed"].includes(j.productionStatus)).map(j => j.orderId)
    )];
    await Promise.all(
      orderIdsToMark.map(orderId =>
        fetch(`/api/orders/${orderId}/production`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productionStatus: "building" })
        }).catch(() => null)
      )
    );

    // Also advance the customer-facing status (what shows on the
    // order's own status dropdown, and what the customer sees/gets
    // emailed about) — production_status above is purely an internal
    // tracking field and was never meant to be the only thing that
    // changes. Every job here is a planter (Cut List Generator is
    // planter-only), which uses the simple order_placed -> being_built
    // -> ready_for_pickup -> picked_up sequence, so it's always safe to
    // advance from order_placed specifically. Reuses the existing
    // status route directly, so the same customer-notification email
    // that route already sends fires here too.
    const orderIdsToAdvanceStatus = [...new Set(
      jobs.filter(j => j.orderStatus === "order_placed").map(j => j.orderId)
    )];
    await Promise.all(
      orderIdsToAdvanceStatus.map(orderId =>
        fetch(`/api/orders/${orderId}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "being_built" })
        }).catch(() => null)
      )
    );

    router.refresh();
  }

  function generateFromManual() {
    const validRows = manualRows.filter(r => r.productId && Number(r.qty) > 0);
    if (validRows.length === 0) {
      setGenerationError("Select at least one product and enter a quantity.");
      return;
    }
    const partLists = validRows.map(r => {
      const parts = (bomPartsByProduct[r.productId] || []).map(toBOMPart);
      return parts.map(p => ({ ...p, quantityPerUnit: p.quantityPerUnit * Number(r.qty) }));
    });
    runOptimization(mergeParts(partLists), "Manual selection", validRows.map(r => ({
      productId: r.productId,
      name: bomReadyProducts.find(p => p.id === r.productId)?.name || "Product",
      quantity: Number(r.qty)
    })));
  }

  function runOptimization(allParts: BOMPart[], label: string, items: { productId: string; name: string; quantity: number; orderId?: string; customerName?: string; orderTitle?: string }[] = [], meta?: { generatedKey: string; jobSig: string[] }) {
    setGenerationError("");
    const merged = new Map<string, { productId: string; name: string; quantity: number; orderId?: string; customerName?: string; orderTitle?: string }>();
    items.forEach(i => {
      // Items for a real order stay separate so each goes to that customer;
      // manual-selection items (no order) are combined per product.
      const key = i.orderId ? `${i.orderId}:${i.productId}` : i.productId;
      const cur = merged.get(key);
      if (cur) cur.quantity += i.quantity; else merged.set(key, { ...i });
    });
    const mergedItems = Array.from(merged.values());
    setGenItems(mergedItems);
    setAutoSent(mergedItems.length > 0);
    const normalParts = allParts.filter(p => !p.isTrim);
    const trimParts = allParts.filter(p => p.isTrim);
    const result = {
      ...(meta || {}),
      normalResults: optimizeByMaterial(normalParts, boardLength, kerf),
      trimResults: optimizeByMaterial(trimParts, boardLength, kerf),
      label
    };
    setGenerated(result);
    // Put it on the Home Screen right away so it can be added to stock later,
    // whether or not there are orders for it yet.
    if (mergedItems.length > 0) {
      fetch("/api/cutlist/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${label} — ${new Date().toLocaleDateString()}`,
          boardLength, kerf,
          resultJson: { ...result, inventory: { status: "pending", items: mergedItems } }
        })
      }).then(() => router.refresh()).catch(() => null);
    }
    setSaveMessage("");
  }

  async function handleSave() {
    if (!generated) return;
    setSaving(true);
    const name = listName.trim() || `${generated.label} — ${new Date().toLocaleDateString()}`;
    const res = await fetch("/api/cutlist/saved", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name, boardLength, kerf,
        resultJson: genItems.length > 0 && !autoSent ? { ...generated, inventory: { status: "pending", items: genItems } } : generated
      })
    });
    setSaving(false);
    if (res.ok) {
      setSaveMessage(genItems.length > 0 && !autoSent ? "Saved. It now shows on your Home Screen under \"Ready to add to inventory\"." : "Saved.");
      setListName("");
      router.refresh();
    }
  }

  async function handleDeleteSaved(id: string) {
    await fetch(`/api/cutlist/saved/${id}`, { method: "DELETE" });
    router.refresh();
  }

  function openSaved(list: { board_length: number; kerf: number; result_json: any; name: string }) {
    setBoardLength(list.board_length);
    setKerf(list.kerf);
    setGenerated({ normalResults: list.result_json.normalResults, trimResults: list.result_json.trimResults, label: list.name });
    setMode("saved");
  }

  return (
    <div>
      <h1 className="font-display text-2xl text-[#1E3A5F] mb-1">Cut List Generator</h1>
      <p className="text-sm text-[#1E3A5F]/60 mb-6 print:hidden">Cedar planter box cutting optimizer, using your real products and orders.</p>

      <div className="flex flex-wrap gap-2 mb-6 print:hidden">
        {([
          ["today", `Today's Cut List (${todayJobs.length} job${todayJobs.length === 1 ? "" : "s"})`],
          ["tomorrow", `Tomorrow's Cut List (${tomorrowJobs.length} job${tomorrowJobs.length === 1 ? "" : "s"})`],
          ["day", "Pick a day"],
          ["manual", "Select products manually"],
          ["saved", "Saved cut lists"]
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => { setMode(key); setGenerationError(""); }}
            className={`px-4 py-2 rounded-md text-sm font-semibold border ${
              mode === key ? "bg-[#1E3A5F] text-white border-[#1E3A5F]" : "bg-white text-[#1E3A5F] border-[#1E3A5F]/20 hover:bg-cream"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="bg-white border border-[#1E3A5F]/10 rounded-xl shadow-sm p-4 mb-6 flex flex-wrap gap-4 items-end print:hidden">
        <div>
          <label className="block text-xs font-semibold text-[#1E3A5F]/50 mb-1">Board length</label>
          <input value={`${boardLength}" (your stock length)`} readOnly className="border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm bg-cream/40 w-56" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#1E3A5F]/50 mb-1">Saw kerf (inches)</label>
          <input type="number" step="0.0625" value={kerf} onChange={e => setKerf(Number(e.target.value))} className="border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm w-28" />
        </div>
      </div>

      {generationError && (
        <div className="bg-red-50 border border-red-200 rounded-md px-3 py-2 mb-4 text-sm text-red-700 print:hidden">{generationError}</div>
      )}

      {(mode === "today" || mode === "tomorrow") && (
        <div className="bg-white border border-[#1E3A5F]/10 rounded-xl shadow-sm p-4 mb-6 print:hidden">
          <div className="text-sm font-semibold text-[#1E3A5F] mb-2">Planter jobs scheduled {mode === "today" ? "today" : "tomorrow"}</div>
          {(mode === "today" ? todayJobs : tomorrowJobs).length === 0 ? (
            <p className="text-sm text-[#1E3A5F]/50">No planter orders scheduled for this day.</p>
          ) : (
            <div className="space-y-1 mb-3">
              {(mode === "today" ? todayJobs : tomorrowJobs).map((j, i) => (
                <div key={i} className="text-sm text-[#1E3A5F]/70 flex justify-between border-b border-[#1E3A5F]/5 py-1">
                  <span>{j.customerName || j.orderTitle}</span>
                  <span>{j.quantity} × {j.productName || "Unknown product"} {j.orderedQuantity != null && j.orderedQuantity !== j.quantity && <span className="text-[#1E3A5F]/60">(ordered {j.orderedQuantity}, {j.orderedQuantity - j.quantity} covered by stock{j.quantity === 0 ? " — nothing to build" : ""}) </span>}{!j.hasBOM && <span className="text-ember font-semibold">(no parts list)</span>}</span>
                </div>
              ))}
            </div>
          )}
          <GenerateOrView dateKey={mode === "today" ? todayStr : tomorrowStr} jobs={mode === "today" ? todayJobs : tomorrowJobs} label={mode === "today" ? "Today's Cut List" : "Tomorrow's Cut List"} buttonText={`Generate ${mode === "today" ? "Today's" : "Tomorrow's"} Cut List`} />
        </div>
      )}

      {mode === "day" && (
        <div className="bg-white border border-[#1E3A5F]/10 rounded-xl shadow-sm p-4 mb-6 print:hidden">
          <div className="flex flex-wrap items-end gap-3 mb-3">
            <div>
              <label htmlFor="cutlist-day" className="block text-xs font-semibold text-[#1E3A5F]/50 mb-1">Day to cut for</label>
              <input id="cutlist-day" type="date" min={todayStr} value={pickedDate} onChange={e => { setPickedDate(e.target.value); setGenerationError(""); }} className="border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="text-sm font-semibold text-[#1E3A5F] mb-2">Planter jobs scheduled {pickedLabel || "for that day"}</div>
          {pickedJobs.length === 0 ? (
            <p className="text-sm text-[#1E3A5F]/50 mb-3">No planter orders scheduled for this day.</p>
          ) : (
            <div className="space-y-1 mb-3">
              {pickedJobs.map((j, i) => (
                <div key={i} className="text-sm text-[#1E3A5F]/70 flex justify-between border-b border-[#1E3A5F]/5 py-1">
                  <span>{j.customerName || j.orderTitle}</span>
                  <span>{j.quantity} × {j.productName || "Unknown product"} {j.orderedQuantity != null && j.orderedQuantity !== j.quantity && <span className="text-[#1E3A5F]/60">(ordered {j.orderedQuantity}, {j.orderedQuantity - j.quantity} covered by stock{j.quantity === 0 ? " — nothing to build" : ""}) </span>}{!j.hasBOM && <span className="text-ember font-semibold">(no parts list)</span>}</span>
                </div>
              ))}
            </div>
          )}
          <GenerateOrView dateKey={pickedDate} jobs={pickedJobs} label={`Cut List for ${pickedLabel}`} buttonText={`Generate Cut List for ${pickedLabel || "this day"}`} />
        </div>
      )}

      {mode === "manual" && (
        <div className="bg-white border border-[#1E3A5F]/10 rounded-xl shadow-sm p-4 mb-6 print:hidden">
          <div className="text-sm font-semibold text-[#1E3A5F] mb-2">Select products manually</div>
          {bomReadyProducts.length === 0 ? (
            <p className="text-sm text-ember">No planter products have a parts list yet — add one on the Products page first.</p>
          ) : (
            <>
              {manualRows.map((row, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <select value={row.productId} onChange={e => setManualRows(rows => rows.map((r, ri) => ri === i ? { ...r, productId: e.target.value } : r))} className="border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm flex-1">
                    {bomReadyProducts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <input type="number" value={row.qty} onChange={e => setManualRows(rows => rows.map((r, ri) => ri === i ? { ...r, qty: e.target.value } : r))} placeholder="Qty" className="border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm w-24" />
                  <button onClick={() => setManualRows(rows => rows.filter((_, ri) => ri !== i))} className="text-ember text-sm font-semibold px-2">Remove</button>
                </div>
              ))}
              <div className="flex gap-2 mt-3">
                <AdminButton variant="secondary" onClick={() => setManualRows(rows => [...rows, { productId: bomReadyProducts[0]?.id || "", qty: "1" }])}>+ Add product</AdminButton>
                <AdminButton onClick={generateFromManual}>Generate Cut List</AdminButton>
              </div>
            </>
          )}
        </div>
      )}

      {mode === "saved" && (
        <div className="bg-white border border-[#1E3A5F]/10 rounded-xl shadow-sm p-4 mb-6 print:hidden">
          <div className="text-sm font-semibold text-[#1E3A5F] mb-2">Saved cut lists</div>
          {savedCutLists.length === 0 ? (
            <p className="text-sm text-[#1E3A5F]/50">Nothing saved yet.</p>
          ) : (
            <div className="space-y-2">
              {savedCutLists.map(list => (
                <div key={list.id} className="flex items-center justify-between border border-[#1E3A5F]/10 rounded-md px-3 py-2">
                  <div>
                    <div className="text-sm font-semibold text-[#1E3A5F]">{list.name}</div>
                    <div className="text-xs text-[#1E3A5F]/50">{new Date(list.created_at).toLocaleString()}</div>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => openSaved(list)} className="text-sm font-semibold text-[#1E3A5F] hover:underline">Open</button>
                    <button onClick={() => handleDeleteSaved(list.id)} className="text-sm font-semibold text-ember hover:underline">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {generated && (
        <div>
          <div className="print:hidden flex flex-wrap items-center gap-2 mb-6 bg-white border border-[#1E3A5F]/10 rounded-xl shadow-sm p-4">
            <input value={listName} onChange={e => setListName(e.target.value)} placeholder="Name this cut list (optional)" className="border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm flex-1 min-w-[200px]" />
            <AdminButton onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save this cut list"}</AdminButton>
            <AdminButton variant="secondary" onClick={() => window.print()}>Print / Save as PDF</AdminButton>
            {autoSent && <span className="text-sm font-semibold text-sage">On your Home Screen — add to stock there.</span>}
            {saveMessage && <span className="text-sm font-semibold text-sage">{saveMessage}</span>}
          </div>

          <div className="mb-2">
            <h2 className="text-xl font-bold text-[#1E3A5F]">{generated.label}</h2>
            <p className="text-xs text-[#1E3A5F]/50">Generated {new Date().toLocaleString()} · Board: {boardLength}{'"'} · Kerf: {kerf}{'"'}</p>
          </div>

          <h3 className="text-lg font-bold text-[#1E3A5F] mb-2">Cut List — Standard Parts</h3>
          {generated.normalResults.length === 0 ? <p className="text-sm text-[#1E3A5F]/50 mb-6">No standard parts in this list.</p> :
            generated.normalResults.map((result, i) => <ResultSection key={i} result={result} />)}

          <div className="my-8 border-t-2 border-dashed border-amber pt-2 print:break-before-page">
            <p className="text-xs font-semibold text-amber uppercase tracking-wide">⚠ Separate list below — trim pieces, final-cut after assembly. Never mix with the parts above.</p>
          </div>

          <h3 className="text-lg font-bold text-amber mb-2">Cut List — Trim (final-cut after assembly)</h3>
          {generated.trimResults.length === 0 ? <p className="text-sm text-[#1E3A5F]/50">No trim parts in this list.</p> :
            generated.trimResults.map((result, i) => <ResultSection key={i} result={result} isTrim />)}
        </div>
      )}
    </div>
  );
}

function ResultSection({ result, isTrim }: { result: OptimizationResult; isTrim?: boolean }) {
  return (
    <div className="mb-8">
      <h4 className="text-sm font-bold mb-2 uppercase tracking-wide text-[#1E3A5F]/60">Material: {result.materialType}</h4>
      {result.oversizedParts.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-md px-3 py-2 mb-3 text-sm text-red-700">
          {result.oversizedParts.length} part(s) are longer than your stock length and were excluded:
          {result.oversizedParts.map((p, i) => <div key={i}>• {p.partName} at {p.length}{'"'}</div>)}
        </div>
      )}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-white border border-[#1E3A5F]/10 rounded-lg p-3 text-center"><div className="text-2xl font-display text-[#1E3A5F]">{result.totalBoards}</div><div className="text-xs text-[#1E3A5F]/50">Boards required</div></div>
        <div className="bg-white border border-[#1E3A5F]/10 rounded-lg p-3 text-center"><div className="text-2xl font-display text-[#1E3A5F]">{result.wastePercent.toFixed(1)}%</div><div className="text-xs text-[#1E3A5F]/50">Waste</div></div>
        <div className="bg-white border border-[#1E3A5F]/10 rounded-lg p-3 text-center"><div className="text-2xl font-display text-[#1E3A5F]">{result.totalWasteInches.toFixed(1)}{'"'}</div><div className="text-xs text-[#1E3A5F]/50">Total scrap</div></div>
      </div>
      {isTrim && result.boards.length > 0 && <p className="text-xs text-[#1E3A5F]/50 mb-2 italic">Rough-cut to the lengths shown, then final-trim after assembly.</p>}
      {result.boards.length === 0 ? <p className="text-sm text-[#1E3A5F]/50">No boards needed.</p> :
        groupIdenticalBoards(result.boards).map((group, i) => <CutDiagram key={i} board={group.board} index={i} count={group.count} />)}
    </div>
  );
}
