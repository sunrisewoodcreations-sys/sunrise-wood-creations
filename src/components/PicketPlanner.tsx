"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import AdminButton from "@/components/AdminButton";
import CutDiagram from "@/components/CutDiagram";
import { groupIdenticalBoards, BOMPart, OptimizationResult } from "@/lib/cutlistOptimizer";
import { planFromPickets, Plan, DEFAULT_BOARD_LENGTH, DEFAULT_KERF } from "@/lib/picketPlanner";

type PlannerProduct = { id: string; name: string; parts: BOMPart[] };

export default function PicketPlanner({
  products,
  picketsOnHand
}: {
  products: PlannerProduct[];
  picketsOnHand: number;
}) {
  const router = useRouter();
  const uid = useId();
  const [picketsInput, setPicketsInput] = useState(picketsOnHand > 0 ? String(picketsOnHand) : "160");
  const [boardLengthInput, setBoardLengthInput] = useState(String(DEFAULT_BOARD_LENGTH));
  const [kerfInput, setKerfInput] = useState(String(DEFAULT_KERF));
  const [selection, setSelection] = useState<Record<string, { checked: boolean; ratio: string }>>(
    () => Object.fromEntries(products.map(p => [p.id, { checked: false, ratio: "1" }]))
  );
  const [plan, setPlan] = useState<Plan | null>(null);
  const [error, setError] = useState("");
  const [listName, setListName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  function calculate() {
    setSaveMessage("");
    const pickets = Math.floor(Number(picketsInput));
    const boardLength = Number(boardLengthInput);
    const kerf = Number(kerfInput);
    if (!(pickets >= 1)) { setError("Enter how many pickets you have (a whole number, 1 or more)."); setPlan(null); return; }
    if (!(boardLength > 0)) { setError("Enter the picket length in inches."); setPlan(null); return; }
    if (!(kerf >= 0)) { setError("Saw kerf can't be negative."); setPlan(null); return; }
    const requests = products
      .filter(p => selection[p.id]?.checked)
      .map(p => ({ id: p.id, ratio: Math.floor(Number(selection[p.id].ratio)) }));
    if (requests.length === 0) { setError("Tick at least one product to build."); setPlan(null); return; }
    if (requests.some(r => !(r.ratio >= 1))) { setError("Each ticked product needs a ratio of 1 or more."); setPlan(null); return; }
    setError("");
    setPlan(planFromPickets(products, requests, pickets, boardLength, kerf));
  }

  async function handleSave() {
    if (!plan) return;
    setSaving(true);
    setSaveMessage("");
    const label = `Picket plan — ${plan.picketsAvailable} pickets`;
    try {
      const res = await fetch("/api/cutlist/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: listName.trim() || `${label} — ${new Date().toLocaleDateString()}`,
          boardLength: plan.boardLength,
          kerf: plan.kerf,
          resultJson: { normalResults: plan.normalResults, trimResults: plan.trimResults, label }
        })
      });
      if (res.ok) {
        setSaveMessage("Saved. Find it under Saved cut lists on the Cut List Generator page.");
        setListName("");
        router.refresh();
      } else {
        setSaveMessage("Couldn't save that. Try again.");
      }
    } catch {
      setSaveMessage("Couldn't save that. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  const fieldClass = "border border-walnut/15 rounded-md px-3 py-2 text-sm bg-white";
  const totalBuilt = plan ? plan.lines.reduce((s, l) => s + l.totalUnits, 0) : 0;

  return (
    <div>
      <h1 className="font-display text-2xl text-walnut mb-1">Picket Planner</h1>
      <p className="text-sm text-walnut/70 mb-6 print:hidden">
        Start of the year, nothing built yet: enter how many pickets you have, tick what you want to build, and see how many
        of each you can get out of them, with the cut list.
      </p>

      <div className="bg-white border border-walnut/10 rounded-xl shadow-sm p-4 mb-6 print:hidden">
        <div className="flex flex-wrap gap-4 items-end mb-4">
          <div>
            <label htmlFor={`${uid}-pickets`} className="block text-xs font-semibold text-walnut/70 mb-1">Pickets you have</label>
            <input id={`${uid}-pickets`} type="number" inputMode="numeric" min={1} step={1} value={picketsInput} onChange={e => setPicketsInput(e.target.value)} className={`${fieldClass} w-32`} />
          </div>
          <div>
            <label htmlFor={`${uid}-length`} className="block text-xs font-semibold text-walnut/70 mb-1">Picket length (inches)</label>
            <input id={`${uid}-length`} type="number" inputMode="decimal" min={1} step="any" value={boardLengthInput} onChange={e => setBoardLengthInput(e.target.value)} className={`${fieldClass} w-32`} />
          </div>
          <div>
            <label htmlFor={`${uid}-kerf`} className="block text-xs font-semibold text-walnut/70 mb-1">Saw kerf (inches)</label>
            <input id={`${uid}-kerf`} type="number" inputMode="decimal" min={0} step="0.0625" value={kerfInput} onChange={e => setKerfInput(e.target.value)} className={`${fieldClass} w-28`} />
          </div>
          {picketsOnHand > 0 && (
            <AdminButton variant="secondary" size="sm" onClick={() => setPicketsInput(String(picketsOnHand))}>
              Use pickets in inventory ({picketsOnHand})
            </AdminButton>
          )}
        </div>

        <fieldset>
          <legend className="text-sm font-semibold text-walnut mb-1">What do you want to build?</legend>
          <p className="text-xs text-walnut/70 mb-3">
            Tick the products. The number beside each is the ratio: <strong>1 and 1</strong> builds an equal amount of each,
            <strong> 2 and 1</strong> builds twice as many of the first as the second. Any pickets left over are then used
            for extras.
          </p>
          {products.length === 0 ? (
            <p className="text-sm text-ember">No products have a parts list yet. Add one on the Products page first.</p>
          ) : (
            <div className="space-y-2">
              {products.map(p => {
                const sel = selection[p.id];
                return (
                  <div key={p.id} className="flex flex-wrap items-center gap-3 border border-walnut/10 rounded-md px-3 py-2">
                    <label className="flex items-center gap-2 text-sm text-walnut flex-1 min-w-[160px]">
                      <input
                        type="checkbox"
                        className="w-auto"
                        checked={sel.checked}
                        onChange={e => setSelection(s => ({ ...s, [p.id]: { ...s[p.id], checked: e.target.checked } }))}
                      />
                      {p.name}
                    </label>
                    <div className="flex items-center gap-2">
                      <label htmlFor={`${uid}-ratio-${p.id}`} className="text-xs text-walnut/70">Ratio</label>
                      <input
                        id={`${uid}-ratio-${p.id}`}
                        type="number"
                        inputMode="numeric"
                        min={1}
                        step={1}
                        disabled={!sel.checked}
                        value={sel.ratio}
                        onChange={e => setSelection(s => ({ ...s, [p.id]: { ...s[p.id], ratio: e.target.value } }))}
                        className={`${fieldClass} w-20 disabled:opacity-50`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </fieldset>

        <div className="mt-4">
          <AdminButton onClick={calculate} disabled={products.length === 0}>Work out what I can build</AdminButton>
        </div>
      </div>

      {error && (
        <div role="alert" className="bg-red-50 border border-red-200 rounded-md px-3 py-2 mb-4 text-sm text-red-700 print:hidden">{error}</div>
      )}

      {plan && (
        <div role="region" aria-label="Plan results">
          {plan.excluded.length > 0 && (
            <div className="bg-amber/10 border border-amber/40 rounded-md px-3 py-2 mb-4 text-sm text-walnut">
              <div className="font-semibold mb-1">Left out of the plan:</div>
              {plan.excluded.map(e => <div key={e.id}>• {e.name}: {e.reason}</div>)}
            </div>
          )}

          {plan.lines.length === 0 ? (
            <p className="text-sm text-walnut/70">Nothing to plan with the products you ticked.</p>
          ) : (
            <>
              <div className="mb-2">
                <h2 className="text-xl font-bold text-walnut">With {plan.picketsAvailable} pickets you can build</h2>
                <p className="text-xs text-walnut/70">
                  {plan.boardLength}&quot; pickets · {plan.kerf}&quot; kerf · generated {new Date().toLocaleString()}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4">
                <div className="bg-white border border-walnut/10 rounded-lg p-3 text-center">
                  <div className="text-lg sm:text-2xl font-display text-walnut">{totalBuilt}</div>
                  <div className="text-xs text-walnut/70">Items in total</div>
                </div>
                <div className="bg-white border border-walnut/10 rounded-lg p-3 text-center">
                  <div className="text-lg sm:text-2xl font-display text-walnut">{plan.picketsUsed} of {plan.picketsAvailable}</div>
                  <div className="text-xs text-walnut/70">Pickets used</div>
                </div>
                <div className="bg-white border border-walnut/10 rounded-lg p-3 text-center">
                  <div className="text-lg sm:text-2xl font-display text-walnut">{plan.picketsLeft}</div>
                  <div className="text-xs text-walnut/70">Pickets left over</div>
                </div>
              </div>

              <div tabIndex={0} role="region" aria-label="Results table (scrolls sideways on small screens)" className="bg-white border border-walnut/10 rounded-xl shadow-sm overflow-x-auto mb-6">
                <table className="w-full text-sm">
                  <caption className="sr-only">How many of each product the pickets make</caption>
                  <thead>
                    <tr className="text-left text-xs text-walnut/70 border-b border-walnut/10">
                      <th scope="col" className="px-3 py-2 font-semibold">Product</th>
                      <th scope="col" className="px-3 py-2 font-semibold text-right">You can build</th>
                      <th scope="col" className="px-3 py-2 font-semibold text-right">From full sets</th>
                      <th scope="col" className="px-3 py-2 font-semibold text-right">Extra from leftovers</th>
                      <th scope="col" className="px-3 py-2 font-semibold text-right">If all pickets went to only this</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan.lines.map(l => (
                      <tr key={l.id} className="border-b border-walnut/5 last:border-0">
                        <th scope="row" className="px-3 py-2 text-left font-semibold text-walnut">{l.name}</th>
                        <td className="px-3 py-2 text-right font-display text-lg text-walnut">{l.totalUnits}</td>
                        <td className="px-3 py-2 text-right text-walnut/80">{l.plannedUnits}</td>
                        <td className="px-3 py-2 text-right text-walnut/80">{l.extraUnits}</td>
                        <td className="px-3 py-2 text-right text-walnut/80">{l.aloneMax}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-walnut/70 mb-6">
                {plan.sets} full set{plan.sets === 1 ? "" : "s"} (one set = {plan.lines.map(l => `${l.ratio} ${l.name}`).join(" + ")}), then extras from what was left.
              </p>

              {plan.otherMaterials.length > 0 && (
                <div className="bg-white border border-walnut/10 rounded-xl shadow-sm p-4 mb-6">
                  <h3 className="text-sm font-bold text-walnut mb-1">Also needed (not from pickets)</h3>
                  <p className="text-xs text-walnut/70 mb-2">These materials don't limit the plan above; this is how much of them these quantities use.</p>
                  {plan.otherMaterials.map(m => (
                    <div key={m.materialType} className="mb-2 last:mb-0">
                      <div className="text-xs font-semibold uppercase tracking-wide text-walnut/70">{m.materialType}</div>
                      {m.parts.map((p, i) => (
                        <div key={i} className="text-sm text-walnut/80">{p.quantity} × {p.partName} at {p.length}&quot;</div>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              <div className="print:hidden flex flex-wrap items-center gap-2 mb-6 bg-white border border-walnut/10 rounded-xl shadow-sm p-4">
                <label htmlFor={`${uid}-name`} className="sr-only">Name for this cut list</label>
                <input id={`${uid}-name`} value={listName} onChange={e => setListName(e.target.value)} placeholder="Name this cut list (optional)" className={`${fieldClass} flex-1 min-w-[200px]`} />
                <AdminButton onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save this cut list"}</AdminButton>
                <AdminButton variant="secondary" onClick={() => window.print()}>Print / Save as PDF</AdminButton>
                {saveMessage && <span role="status" className="text-sm font-semibold text-walnut">{saveMessage}</span>}
              </div>

              <h3 className="text-lg font-bold text-walnut mb-2">Cut list — standard parts</h3>
              {plan.normalResults.length === 0 || plan.normalResults.every(r => r.boards.length === 0)
                ? <p className="text-sm text-walnut/70 mb-6">No standard parts in this plan.</p>
                : plan.normalResults.map((r, i) => <ResultSection key={i} result={r} />)}

              <div className="my-8 border-t-2 border-dashed border-amber pt-2 print:break-before-page">
                <p className="text-xs font-semibold text-walnut uppercase tracking-wide">⚠ Separate list below — trim pieces, final-cut after assembly. Never mix with the parts above.</p>
              </div>
              <h3 className="text-lg font-bold text-walnut mb-2">Cut list — trim (final-cut after assembly)</h3>
              {plan.trimResults.length === 0 || plan.trimResults.every(r => r.boards.length === 0)
                ? <p className="text-sm text-walnut/70">No trim parts in this plan.</p>
                : plan.trimResults.map((r, i) => <ResultSection key={i} result={r} isTrim />)}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ResultSection({ result, isTrim }: { result: OptimizationResult; isTrim?: boolean }) {
  return (
    <div className="mb-8">
      <h4 className="text-sm font-bold mb-2 uppercase tracking-wide text-walnut/70">Material: {result.materialType}</h4>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-white border border-walnut/10 rounded-lg p-3 text-center"><div className="text-2xl font-display text-walnut">{result.totalBoards}</div><div className="text-xs text-walnut/70">Pickets required</div></div>
        <div className="bg-white border border-walnut/10 rounded-lg p-3 text-center"><div className="text-2xl font-display text-walnut">{result.wastePercent.toFixed(1)}%</div><div className="text-xs text-walnut/70">Waste</div></div>
        <div className="bg-white border border-walnut/10 rounded-lg p-3 text-center"><div className="text-2xl font-display text-walnut">{result.totalWasteInches.toFixed(1)}{'"'}</div><div className="text-xs text-walnut/70">Total scrap</div></div>
      </div>
      {isTrim && result.boards.length > 0 && <p className="text-xs text-walnut/70 mb-2 italic">Rough-cut to the lengths shown, then final-trim after assembly.</p>}
      {result.boards.length === 0
        ? <p className="text-sm text-walnut/70">No pickets needed.</p>
        : groupIdenticalBoards(result.boards).map((group, i) => <CutDiagram key={i} board={group.board} index={i} count={group.count} />)}
    </div>
  );
}
