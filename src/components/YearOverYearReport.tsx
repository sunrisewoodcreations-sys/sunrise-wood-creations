"use client";

import { useMemo, useState } from "react";
import { SaleRow, Metric, Range, compareTotal, compareByMonth, compareByWeek, addDays, lastYearOf } from "@/lib/yoy";

const money = (cents: number) => `${cents < 0 ? "-" : ""}$${(Math.abs(cents) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const show = (v: number, metric: Metric) => (metric === "orders" ? String(v) : money(v));
const fmtDate = (s: string) => new Date(s + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const shortRange = (r: Range) => `${fmtDate(r.start)} – ${fmtDate(r.end)}`;

function Diff({ value, pct, metric }: { value: number; pct: number | null; metric: Metric }) {
  const up = value > 0, down = value < 0;
  const color = up ? "text-sage" : down ? "text-ember" : "text-[#1E3A5F]/50";
  const sign = up ? "+" : "";
  return (
    <span className={`font-semibold ${color}`}>
      {sign}{metric === "orders" ? value : money(value)}
      <span className="font-normal text-xs ml-1">{pct == null ? "(no last-year sales)" : `(${sign}${pct.toFixed(0)}%)`}</span>
    </span>
  );
}

export default function YearOverYearReport({ today, pickedUp, placed }: { today: string; pickedUp: SaleRow[]; placed: SaleRow[] }) {
  const year = Number(today.slice(0, 4));
  const [basis, setBasis] = useState<"pickedUp" | "placed">("pickedUp");
  const [metric, setMetric] = useState<Metric>("sales");
  const [start, setStart] = useState(`${year}-01-01`);
  const [end, setEnd] = useState(today);

  const rows = basis === "pickedUp" ? pickedUp : placed;
  const range: Range = useMemo(() => (start <= end ? { start, end } : { start: end, end: start }), [start, end]);

  const total = useMemo(() => compareTotal(rows, range, metric), [rows, range, metric]);
  const months = useMemo(() => compareByMonth(rows, range, metric), [rows, range, metric]);
  const weeks = useMemo(() => compareByWeek(rows, range, metric), [rows, range, metric]);

  function preset(kind: "ytd" | "month" | "30" | "quarter" | "lastyear") {
    const [y, m] = today.split("-").map(Number);
    if (kind === "ytd") { setStart(`${y}-01-01`); setEnd(today); }
    if (kind === "month") { setStart(`${y}-${String(m).padStart(2, "0")}-01`); setEnd(today); }
    if (kind === "30") { setStart(addDays(today, -29)); setEnd(today); }
    if (kind === "quarter") { const qm = Math.floor((m - 1) / 3) * 3 + 1; setStart(`${y}-${String(qm).padStart(2, "0")}-01`); setEnd(today); }
    if (kind === "lastyear") { setStart(`${y - 1}-01-01`); setEnd(`${y - 1}-12-31`); }
  }

  const btn = "border border-[#1E3A5F]/20 text-[#1E3A5F] px-3 py-1.5 rounded-md text-xs font-semibold hover:bg-cream";
  const seg = (active: boolean) => `px-3 py-1.5 text-xs font-semibold border ${active ? "bg-[#1E3A5F] text-white border-[#1E3A5F]" : "bg-white text-[#1E3A5F] border-[#1E3A5F]/20 hover:bg-cream"}`;
  const label = metric === "sales" ? "Sales" : metric === "profit" ? "Profit" : "Orders";
  const noData = total.thisValue === 0 && total.lastValue === 0;

  return (
    <div>
      <div className="bg-white border border-[#1E3A5F]/10 rounded-xl shadow-sm p-4 mb-6 print:hidden">
        <div className="flex flex-wrap items-end gap-3 mb-3">
          <div>
            <label htmlFor="yoy-start" className="block text-xs font-semibold text-[#1E3A5F]/60 mb-1">From</label>
            <input id="yoy-start" type="date" value={start} max={today} onChange={e => e.target.value && setStart(e.target.value)} className="border border-[#1E3A5F]/20 rounded-md px-3 py-2 text-sm bg-white" />
          </div>
          <div>
            <label htmlFor="yoy-end" className="block text-xs font-semibold text-[#1E3A5F]/60 mb-1">To</label>
            <input id="yoy-end" type="date" value={end} max={today} onChange={e => e.target.value && setEnd(e.target.value)} className="border border-[#1E3A5F]/20 rounded-md px-3 py-2 text-sm bg-white" />
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btn} onClick={() => preset("ytd")}>Year to date</button>
            <button type="button" className={btn} onClick={() => preset("quarter")}>This quarter</button>
            <button type="button" className={btn} onClick={() => preset("month")}>This month</button>
            <button type="button" className={btn} onClick={() => preset("30")}>Last 30 days</button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div role="group" aria-label="What to compare" className="flex">
            <button type="button" aria-pressed={metric === "sales"} onClick={() => setMetric("sales")} className={`${seg(metric === "sales")} rounded-l-md`}>Sales</button>
            <button type="button" aria-pressed={metric === "profit"} onClick={() => setMetric("profit")} className={`${seg(metric === "profit")} -ml-px`}>Profit</button>
            <button type="button" aria-pressed={metric === "orders"} onClick={() => setMetric("orders")} className={`${seg(metric === "orders")} -ml-px rounded-r-md`}>Orders</button>
          </div>
          <div role="group" aria-label="Count a sale when" className="flex items-center gap-2">
            <span className="text-xs text-[#1E3A5F]/60">Count a sale when it's</span>
            <div className="flex">
              <button type="button" aria-pressed={basis === "pickedUp"} onClick={() => setBasis("pickedUp")} className={`${seg(basis === "pickedUp")} rounded-l-md`}>Picked up / delivered</button>
              <button type="button" aria-pressed={basis === "placed"} onClick={() => setBasis("placed")} className={`${seg(basis === "placed")} -ml-px rounded-r-md`}>Ordered</button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-2">
        <div className="bg-white border border-[#1E3A5F]/10 rounded-xl shadow-sm p-5">
          <div className="text-xs text-[#1E3A5F]/60 uppercase tracking-wide mb-1">{label} this year</div>
          <div className="text-2xl font-display text-[#1E3A5F]">{show(total.thisValue, metric)}</div>
          <div className="text-xs text-[#1E3A5F]/60 mt-1">{shortRange(range)}</div>
        </div>
        <div className="bg-white border border-[#1E3A5F]/10 rounded-xl shadow-sm p-5">
          <div className="text-xs text-[#1E3A5F]/60 uppercase tracking-wide mb-1">{label} same dates last year</div>
          <div className="text-2xl font-display text-[#1E3A5F]">{show(total.lastValue, metric)}</div>
          <div className="text-xs text-[#1E3A5F]/60 mt-1">{shortRange({ start: lastYearOf(range.start), end: lastYearOf(range.end) })}</div>
        </div>
        <div className="bg-white border-2 border-[#1E3A5F]/15 rounded-xl shadow-sm p-5">
          <div className="text-xs text-[#1E3A5F]/60 uppercase tracking-wide mb-1">Difference</div>
          <div className="text-2xl font-display"><Diff value={total.diff} pct={total.pct} metric={metric} /></div>
          <div className="text-xs text-[#1E3A5F]/60 mt-1">{total.diff > 0 ? "Ahead of" : total.diff < 0 ? "Behind" : "Even with"} last year</div>
        </div>
      </div>
      {noData && <p className="text-sm text-[#1E3A5F]/60 mb-4">No sales found in either period for these dates.</p>}
      {!noData && total.lastValue === 0 && <p className="text-sm text-[#1E3A5F]/60 mb-4">No sales were recorded for these dates last year, so there's nothing to compare against yet.</p>}

      <Table title="By month" firstCol="Month" rows={months} metric={metric} />
      <Table title="By week" firstCol="Week" rows={weeks} metric={metric} />
    </div>
  );
}

function Table({ title, firstCol, rows, metric }: { title: string; firstCol: string; rows: ReturnType<typeof compareByMonth>; metric: Metric }) {
  const sumThis = rows.reduce((s, r) => s + r.thisValue, 0);
  const sumLast = rows.reduce((s, r) => s + r.lastValue, 0);
  return (
    <div className="mt-8">
      <h2 className="font-display text-lg text-[#1E3A5F] mb-2">{title}</h2>
      <div className="overflow-x-auto bg-white border border-[#1E3A5F]/10 rounded-xl shadow-sm" tabIndex={0} role="region" aria-label={`${title} comparison table`}>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#1E3A5F] text-white text-xs uppercase tracking-wide">
              <th className="text-left px-4 py-3">{firstCol}</th>
              <th className="text-left px-4 py-3">Dates</th>
              <th className="text-right px-4 py-3">This year</th>
              <th className="text-right px-4 py-3">Last year</th>
              <th className="text-right px-4 py-3">Difference</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-[#1E3A5F]/10">
                <td className="px-4 py-3 font-semibold text-[#1E3A5F] whitespace-nowrap">{r.label}</td>
                <td className="px-4 py-3 text-xs text-[#1E3A5F]/60 whitespace-nowrap">{shortRange(r.thisYear)}<br />vs {shortRange(r.lastYear)}</td>
                <td className="px-4 py-3 text-right text-[#1E3A5F]">{show(r.thisValue, metric)}</td>
                <td className="px-4 py-3 text-right text-[#1E3A5F]/80">{show(r.lastValue, metric)}</td>
                <td className="px-4 py-3 text-right whitespace-nowrap"><Diff value={r.diff} pct={r.pct} metric={metric} /></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-[#1E3A5F]/20 bg-cream/40 font-semibold">
              <td className="px-4 py-3 text-[#1E3A5F]" colSpan={2}>Total</td>
              <td className="px-4 py-3 text-right text-[#1E3A5F]">{show(sumThis, metric)}</td>
              <td className="px-4 py-3 text-right text-[#1E3A5F]/80">{show(sumLast, metric)}</td>
              <td className="px-4 py-3 text-right whitespace-nowrap"><Diff value={sumThis - sumLast} pct={sumLast !== 0 ? ((sumThis - sumLast) / Math.abs(sumLast)) * 100 : null} metric={metric} /></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
