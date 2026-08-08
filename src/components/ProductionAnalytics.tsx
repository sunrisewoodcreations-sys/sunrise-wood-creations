"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type ProductStat = { name: string; quantity: number; totalMinutes: number; estimatedMinutesPerUnit: number | null; revenueCents: number };

function formatHours(minutes: number): string {
  if (minutes === 0) return "0h";
  const hours = minutes / 60;
  return `${hours.toFixed(hours % 1 === 0 ? 0 : 1)}h`;
}
function formatDollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function ProductionAnalytics({
  rangeLabel,
  currentRange,
  customStart,
  customEnd,
  ordersCompletedToday,
  ordersCompletedWeek,
  ordersCompletedMonth,
  ordersCompletedYear,
  ordersCompletedAllTime,
  revenueTodayCents,
  revenueWeekCents,
  revenueMonthCents,
  revenueYearCents,
  revenueAllTimeCents,
  ordersInRangeCount,
  totalBuildMinutes,
  actualPicketsUsed,
  mostBuiltByQuantity,
  mostBuiltByRevenue,
  revenueCents
}: {
  rangeLabel: string;
  currentRange: string;
  customStart: string;
  customEnd: string;
  ordersCompletedToday: number;
  ordersCompletedWeek: number;
  ordersCompletedMonth: number;
  ordersCompletedYear: number;
  ordersCompletedAllTime: number;
  revenueTodayCents: number;
  revenueWeekCents: number;
  revenueMonthCents: number;
  revenueYearCents: number;
  revenueAllTimeCents: number;
  ordersInRangeCount: number;
  totalBuildMinutes: number;
  actualPicketsUsed: number;
  mostBuiltByQuantity: ProductStat[];
  mostBuiltByRevenue: ProductStat[];
  revenueCents: number;
}) {
  const router = useRouter();
  const [customStartInput, setCustomStartInput] = useState(customStart);
  const [customEndInput, setCustomEndInput] = useState(customEnd);

  const periods = [
    { label: "Today", orders: ordersCompletedToday, revenue: revenueTodayCents },
    { label: "This Week", orders: ordersCompletedWeek, revenue: revenueWeekCents },
    { label: "This Month", orders: ordersCompletedMonth, revenue: revenueMonthCents },
    { label: "This Year", orders: ordersCompletedYear, revenue: revenueYearCents },
    { label: "All Time", orders: ordersCompletedAllTime, revenue: revenueAllTimeCents }
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-1 print:hidden">
        <h1 className="font-display text-2xl text-[#1E3A5F]">Production Analytics</h1>
        <button onClick={() => window.print()} className="border border-[#1E3A5F]/20 text-[#1E3A5F] px-4 py-2 rounded-md text-sm font-semibold hover:bg-cream">
          Print summary
        </button>
      </div>
      <p className="text-sm text-[#1E3A5F]/60 mb-6">
        "Completed" here matches the workflow engine's own definition — an order the customer has actually picked up.
      </p>

      {/* Always-visible: orders completed and revenue, for every fixed
          period, independent of the range filter used for the detailed
          breakdown further down. */}
      <div className="overflow-x-auto bg-white border border-[#1E3A5F]/10 rounded-xl shadow-sm mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#1E3A5F] text-white text-xs uppercase tracking-wide">
              <th className="text-left px-4 py-3">Period</th>
              <th className="text-right px-4 py-3">Orders completed</th>
              <th className="text-right px-4 py-3">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {periods.map(p => (
              <tr key={p.label} className="border-t border-[#1E3A5F]/10">
                <td className="px-4 py-2.5 font-semibold text-[#1E3A5F]">{p.label}</td>
                <td className="px-4 py-2.5 text-right text-[#1E3A5F]/70">{p.orders}</td>
                <td className="px-4 py-2.5 text-right text-sage font-semibold">{formatDollars(p.revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Range filters for the detailed breakdown below */}
      <div className="flex flex-wrap items-center gap-2 mb-6 print:hidden">
        {(["today", "week", "month", "year"] as const).map(key => (
          <button
            key={key}
            onClick={() => router.push(`/admin/production-analytics?range=${key}`)}
            className={`px-4 py-2 rounded-md text-sm font-semibold border ${
              currentRange === key ? "bg-[#1E3A5F] text-white border-[#1E3A5F]" : "bg-white text-[#1E3A5F] border-[#1E3A5F]/20 hover:bg-cream"
            }`}
          >
            {key === "today" ? "Today" : key === "week" ? "This Week" : key === "month" ? "This Month" : "This Year"}
          </button>
        ))}
        <div className="flex items-center gap-1.5 border border-[#1E3A5F]/20 rounded-md px-2 py-1">
          <input type="date" value={customStartInput} onChange={e => setCustomStartInput(e.target.value)} className="text-xs border-none focus:outline-none" />
          <span className="text-xs text-[#1E3A5F]/40">to</span>
          <input type="date" value={customEndInput} onChange={e => setCustomEndInput(e.target.value)} className="text-xs border-none focus:outline-none" />
          <button
            onClick={() => router.push(`/admin/production-analytics?range=custom&start=${customStartInput}&end=${customEndInput}`)}
            className={`px-2 py-1 rounded text-xs font-semibold ${currentRange === "custom" ? "bg-[#1E3A5F] text-white" : "text-[#1E3A5F] hover:bg-cream"}`}
          >
            Go
          </button>
        </div>
      </div>

      <div className="mb-4">
        <h2 className="font-display text-lg text-[#1E3A5F]">{rangeLabel} — {ordersInRangeCount} order{ordersInRangeCount === 1 ? "" : "s"} completed</h2>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Stat label="Total build hours" value={formatHours(totalBuildMinutes)} accent="amber" />
        <Stat label="Actual pickets used" value={String(actualPicketsUsed)} accent="sage" />
        <Stat label="Revenue" value={formatDollars(revenueCents)} accent="sage" />
        <Stat label="Orders completed" value={String(ordersInRangeCount)} />
      </div>
      <p className="text-xs text-[#1E3A5F]/40 italic mb-6 print:hidden">
        Actual pickets used reflects real consumption already tracked for cedar planters. Other materials don't have
        real usage tracking yet, matching how Material Planning already handles this.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ProductTable title="Most-built products — by quantity" products={mostBuiltByQuantity} sortMetric="quantity" />
        <ProductTable title="Most-built products — by revenue" products={mostBuiltByRevenue} sortMetric="revenue" />
      </div>
    </div>
  );
}

function ProductTable({ title, products, sortMetric }: { title: string; products: ProductStat[]; sortMetric: "quantity" | "revenue" }) {
  return (
    <div className="bg-white border border-[#1E3A5F]/10 rounded-xl shadow-sm p-4 print:break-inside-avoid">
      <h3 className="font-display text-base text-[#1E3A5F] mb-1">{title}</h3>
      {sortMetric === "quantity" && (
        <p className="text-xs text-[#1E3A5F]/50 mb-3">
          Average build time uses each product's estimated build minutes — real per-build time tracking doesn't exist yet, so this reflects the estimate, not a measured average.
        </p>
      )}
      {products.length === 0 ? (
        <p className="text-sm text-[#1E3A5F]/50">Nothing completed in this range.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#1E3A5F] text-white text-xs uppercase tracking-wide">
              <th className="text-left px-3 py-2">Product</th>
              <th className="text-right px-3 py-2">Qty</th>
              <th className="text-right px-3 py-2">Revenue</th>
              <th className="text-right px-3 py-2">Build time</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p, i) => (
              <tr key={i} className="border-t border-[#1E3A5F]/10">
                <td className="px-3 py-2 font-semibold text-[#1E3A5F]">{p.name}</td>
                <td className="px-3 py-2 text-right text-[#1E3A5F]/70">{p.quantity}</td>
                <td className="px-3 py-2 text-right text-sage font-semibold">{formatDollars(p.revenueCents)}</td>
                <td className="px-3 py-2 text-right text-[#1E3A5F]/70">
                  {p.totalMinutes > 0 ? formatHours(p.totalMinutes) : <span className="text-[#1E3A5F]/30 italic text-xs">Not tracked</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: "sage" | "amber" }) {
  const colorClass = accent === "sage" ? "text-sage" : accent === "amber" ? "text-amber" : "text-[#1E3A5F]";
  return (
    <div className="bg-white border border-[#1E3A5F]/10 rounded-xl shadow-sm p-3 text-center">
      <div className={`text-xl font-display ${colorClass}`}>{value}</div>
      <div className="text-[10px] text-[#1E3A5F]/50 uppercase tracking-wide">{label}</div>
    </div>
  );
}
