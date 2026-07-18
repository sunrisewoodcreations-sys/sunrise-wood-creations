"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MaterialPlanningResult, MaterialRequirement } from "@/lib/materialPlanning";

export default function MaterialPlanning({
  result,
  readiness,
  currentRange,
  customStart,
  customEnd
}: {
  result: MaterialPlanningResult;
  readiness: { ready: boolean; shortages: MaterialRequirement[] };
  currentRange: string;
  customStart: string;
  customEnd: string;
}) {
  const router = useRouter();
  const [expandedMaterial, setExpandedMaterial] = useState<string | null>(null);
  const [expandedView, setExpandedView] = useState<"parts" | "orders">("parts");
  const [customStartInput, setCustomStartInput] = useState(customStart);
  const [customEndInput, setCustomEndInput] = useState(customEnd);

  function toggleMaterial(materialType: string, view: "parts" | "orders") {
    if (expandedMaterial === materialType && expandedView === view) {
      setExpandedMaterial(null);
    } else {
      setExpandedMaterial(materialType);
      setExpandedView(view);
    }
  }

  // Derived from the result that's already been computed once server-side
  // — no extra queries, no re-running the optimizer. "Pickets" refers to
  // your one currently-tracked material (Cedar); the generic per-material
  // table below still covers everything else.
  const cedarReq = result.requirements.find(r => r.materialType.trim().toLowerCase() === "cedar");
  const totalPicketsRequired = cedarReq?.optimization.totalBoards ?? 0;
  const picketsOnHand = cedarReq?.onHandQuantity ?? null;
  const picketsShort = cedarReq?.shortQuantity ?? null;
  const estimatedWaste = cedarReq?.optimization.wastePercent ?? 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-1 print:hidden">
        <h1 className="font-display text-2xl text-[#1E3A5F]">Material Planning</h1>
        <div className="flex gap-2">
          <Link href="/admin/cutlist" className="text-xs font-semibold text-[#1E3A5F] border border-[#1E3A5F]/20 rounded-md px-3 py-1.5 hover:bg-cream">
            Cut List Generator →
          </Link>
          <Link href="/admin/pickets" className="text-xs font-semibold text-[#1E3A5F] border border-[#1E3A5F]/20 rounded-md px-3 py-1.5 hover:bg-cream">
            Picket Inventory →
          </Link>
        </div>
      </div>
      <p className="text-sm text-[#1E3A5F]/60 mb-6 print:hidden">
        What material your scheduled production actually needs, compared against what's on hand.
      </p>

      {/* Large, hard-to-miss warning when short — shows the exact
          picket shortfall, per your requirement. Falls back to the
          existing compact "ready" banner when everything's fine, so
          this doesn't take up unnecessary space on a normal day. */}
      {picketsShort != null && picketsShort > 0 ? (
        <div className="bg-ember text-white rounded-xl shadow-sm p-5 mb-6 print:hidden">
          <div className="flex items-center gap-4">
            <span className="text-4xl font-display leading-none">{picketsShort}</span>
            <div>
              <div className="text-base font-bold">Pickets short for {result.rangeLabel.toLowerCase()}</div>
              <div className="text-sm text-white/80">You need {totalPicketsRequired} but only have {picketsOnHand} on hand — order more before you start building.</div>
            </div>
          </div>
        </div>
      ) : (
        <div className={`rounded-xl shadow-sm p-4 mb-6 border-2 print:hidden ${
          readiness.ready ? "bg-sage/10 border-sage" : "bg-ember/10 border-ember"
        }`}>
          <div className="flex items-center gap-3">
            <span className={`w-4 h-4 rounded-full flex-shrink-0 ${readiness.ready ? "bg-sage" : "bg-ember"}`} />
            <div>
              <div className={`text-sm font-bold ${readiness.ready ? "text-sage" : "text-ember"}`}>
                {readiness.ready ? "Ready to build today — enough material on hand" : "Short on material for today's schedule"}
              </div>
              {!readiness.ready && (
                <div className="text-xs text-[#1E3A5F]/60 mt-0.5">
                  {readiness.shortages.map(s => `${s.materialType}: short ${s.shortQuantity}`).join(" · ")}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Top summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6 print:hidden">
        <Stat label="Orders Scheduled" value={String(result.ordersInRange)} />
        <Stat label="Total Pickets Required" value={String(totalPicketsRequired)} />
        <Stat label="Pickets On Hand" value={picketsOnHand == null ? "—" : String(picketsOnHand)} />
        <Stat
          label="Pickets Short"
          value={picketsShort == null ? "—" : String(picketsShort)}
          accent={picketsShort != null && picketsShort > 0 ? "ember" : undefined}
        />
        <Stat label="Estimated Waste %" value={`${estimatedWaste.toFixed(1)}%`} />
      </div>

      {/* Range filters */}
      <div className="flex flex-wrap items-center gap-2 mb-6 print:hidden">
        {([["today", "Today"], ["tomorrow", "Tomorrow"], ["week", "This Week"]] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => router.push(`/admin/material-planning?range=${key}`)}
            className={`px-4 py-2 rounded-md text-sm font-semibold border ${
              currentRange === key ? "bg-[#1E3A5F] text-white border-[#1E3A5F]" : "bg-white text-[#1E3A5F] border-[#1E3A5F]/20 hover:bg-cream"
            }`}
          >
            {label}
          </button>
        ))}
        <div className="flex items-center gap-1.5 border border-[#1E3A5F]/20 rounded-md px-2 py-1">
          <input type="date" value={customStartInput} onChange={e => setCustomStartInput(e.target.value)} className="text-xs border-none focus:outline-none" />
          <span className="text-xs text-[#1E3A5F]/40">to</span>
          <input type="date" value={customEndInput} onChange={e => setCustomEndInput(e.target.value)} className="text-xs border-none focus:outline-none" />
          <button
            onClick={() => router.push(`/admin/material-planning?range=custom&start=${customStartInput}&end=${customEndInput}`)}
            className={`px-2 py-1 rounded text-xs font-semibold ${currentRange === "custom" ? "bg-[#1E3A5F] text-white" : "text-[#1E3A5F] hover:bg-cream"}`}
          >
            Go
          </button>
        </div>
        <button onClick={() => window.print()} className="ml-auto border border-[#1E3A5F]/20 text-[#1E3A5F] px-4 py-2 rounded-md text-sm font-semibold hover:bg-cream">
          Print shopping list
        </button>
      </div>

      <div className="mb-4 print:mb-6">
        <h2 className="font-display text-lg text-[#1E3A5F]">{result.rangeLabel}</h2>
        <p className="text-xs text-[#1E3A5F]/50">{result.ordersInRange} order{result.ordersInRange === 1 ? "" : "s"} scheduled in this range</p>
      </div>

      {result.requirements.length === 0 ? (
        <div className="bg-white border border-[#1E3A5F]/10 rounded-xl shadow-sm px-4 py-8 text-center text-sm text-[#1E3A5F]/50">
          Nothing scheduled for production in this range.
        </div>
      ) : (
        <>
        {/* Material Summary — one row per material, for a fast scan
            across everything before drilling into any one material's
            detail card below. Same requirement data, just a second view
            of it — no recalculation. */}
        <div className="overflow-x-auto bg-white border border-[#1E3A5F]/10 rounded-xl shadow-sm mb-6 print:hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#1E3A5F] text-white text-xs uppercase tracking-wide">
                <th className="text-left px-4 py-3">Material</th>
                <th className="text-right px-4 py-3">On Hand</th>
                <th className="text-right px-4 py-3">Required</th>
                <th className="text-right px-4 py-3">Remaining</th>
                <th className="text-right px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {result.requirements.map(req => {
                const remaining = req.onHandQuantity != null ? req.onHandQuantity - req.optimization.totalBoards : null;
                const isShort = req.shortQuantity != null && req.shortQuantity > 0;
                return (
                  <tr key={req.materialType} className="border-t border-[#1E3A5F]/10">
                    <td className="px-4 py-3 font-semibold text-[#1E3A5F]">{req.materialType}</td>
                    <td className="px-4 py-3 text-right text-[#1E3A5F]/70">{req.onHandQuantity == null ? "—" : req.onHandQuantity}</td>
                    <td className="px-4 py-3 text-right text-[#1E3A5F]/70">{req.optimization.totalBoards}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${remaining != null && remaining < 0 ? "text-ember" : "text-[#1E3A5F]/70"}`}>
                      {remaining == null ? "—" : remaining}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {req.onHandQuantity == null ? (
                        <span className="text-xs text-[#1E3A5F]/40">Not tracked</span>
                      ) : (
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${isShort ? "bg-ember/15 text-ember" : "bg-sage/15 text-sage"}`}>
                          {isShort ? "Short" : "Enough"}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="space-y-4">
          {result.requirements.map(req => {
            const isShort = req.shortQuantity != null && req.shortQuantity > 0;
            return (
              <div key={req.materialType} className="bg-white border border-[#1E3A5F]/10 rounded-xl shadow-sm p-4 print:break-inside-avoid">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-display text-base text-[#1E3A5F]">{req.materialType}</h3>
                  {req.onHandQuantity == null ? (
                    <span className="text-xs font-semibold bg-[#1E3A5F]/10 text-[#1E3A5F]/60 px-2.5 py-1 rounded-full">
                      No inventory tracked for this material yet
                    </span>
                  ) : (
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${isShort ? "bg-ember/15 text-ember" : "bg-sage/15 text-sage"}`}>
                      {isShort ? `Short ${req.shortQuantity}` : "Enough on hand"}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-3">
                  <Stat label="In stock" value={req.onHandQuantity == null ? "—" : String(req.onHandQuantity)} />
                  <Stat label="Needed (boards)" value={String(req.optimization.totalBoards)} />
                  <Stat label="Short" value={req.shortQuantity == null ? "—" : String(req.shortQuantity)} accent={isShort ? "ember" : undefined} />
                  <Stat label="Waste %" value={`${req.optimization.wastePercent.toFixed(1)}%`} />
                  <Stat label="Total boards" value={String(req.optimization.totalBoards)} />
                </div>

                <div className="flex gap-4 print:hidden">
                  <button
                    onClick={() => toggleMaterial(req.materialType, "parts")}
                    className="text-xs font-semibold text-[#1E3A5F] hover:underline"
                  >
                    {expandedMaterial === req.materialType && expandedView === "parts" ? "Hide parts" : `See ${req.parts.length} part(s) making up this total`}
                  </button>
                  <button
                    onClick={() => toggleMaterial(req.materialType, "orders")}
                    className="text-xs font-semibold text-[#1E3A5F] hover:underline"
                  >
                    {expandedMaterial === req.materialType && expandedView === "orders" ? "Hide orders" : `See ${req.contributingOrders.length} order(s) using this material`}
                  </button>
                </div>

                {expandedMaterial === req.materialType && expandedView === "parts" && (
                  <div className="mt-3 pt-3 border-t border-[#1E3A5F]/10">
                    {req.parts.map((p, i) => (
                      <div key={i} className="flex justify-between text-sm py-1 border-b border-[#1E3A5F]/5 last:border-0">
                        <span className="text-[#1E3A5F]/70">{p.partName} — {p.length}{'"'}</span>
                        <span className="font-semibold text-[#1E3A5F]">× {p.totalQuantity}</span>
                      </div>
                    ))}
                  </div>
                )}

                {expandedMaterial === req.materialType && expandedView === "orders" && (
                  <div className="mt-3 pt-3 border-t border-[#1E3A5F]/10">
                    {req.contributingOrders.map(o => (
                      <div key={o.orderId} className="flex justify-between text-sm py-1 border-b border-[#1E3A5F]/5 last:border-0">
                        <Link href={`/admin/orders/${o.orderId}`} className="text-[#1E3A5F] hover:underline">{o.customerName} — {o.orderTitle}</Link>
                        <span className="text-[#1E3A5F]/60">{o.pieceCount} pieces, {o.totalInches.toFixed(0)}{'"'}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Print-only: always show the full parts breakdown, since
                    interactive expand/collapse doesn't apply on paper. */}
                <div className="hidden print:block mt-3 pt-3 border-t border-[#1E3A5F]/10">
                  <div className="text-xs font-semibold text-[#1E3A5F]/50 uppercase mb-1">Shopping list — parts needed</div>
                  {req.parts.map((p, i) => (
                    <div key={i} className="flex justify-between text-sm py-0.5">
                      <span>{p.partName} — {p.length}{'"'}</span>
                      <span>× {p.totalQuantity}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: "ember" }) {
  return (
    <div className="bg-cream/40 border border-[#1E3A5F]/10 rounded-lg p-2 text-center">
      <div className={`text-lg font-display ${accent === "ember" ? "text-ember" : "text-[#1E3A5F]"}`}>{value}</div>
      <div className="text-[10px] text-[#1E3A5F]/50 uppercase tracking-wide">{label}</div>
    </div>
  );
}
