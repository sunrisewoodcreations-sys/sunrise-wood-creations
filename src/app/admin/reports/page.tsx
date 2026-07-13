import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const SALES_TAX_RATE = 0.06;

function easternMidnightUtc(year: number, month: number, day: number): Date {
  for (const offsetHours of [4, 5]) {
    const guess = new Date(Date.UTC(year, month - 1, day, offsetHours, 0, 0));
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false
    }).formatToParts(guess);
    const y = Number(parts.find(p => p.type === "year")?.value);
    const m = Number(parts.find(p => p.type === "month")?.value);
    const d = Number(parts.find(p => p.type === "day")?.value);
    const h = Number(parts.find(p => p.type === "hour")?.value) % 24;
    if (y === year && m === month && d === day && h === 0) return guess;
  }
  return new Date(Date.UTC(year, month - 1, day, 5, 0, 0));
}

function easternParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "numeric" }).formatToParts(date);
  return {
    year: Number(parts.find(p => p.type === "year")?.value),
    month: Number(parts.find(p => p.type === "month")?.value)
  };
}

async function getPeriodTotals(supabase: ReturnType<typeof createClient>, start: Date | null, end: Date) {
  let pickupQuery = supabase
    .from("order_status_history")
    .select("order_id, created_at")
    .eq("status", "picked_up")
    .lt("created_at", end.toISOString());
  if (start) pickupQuery = pickupQuery.gte("created_at", start.toISOString());

  const { data: pickupEvents } = await pickupQuery;
  const orderIds: string[] = [];
  const seen = new Set<string>();
  (pickupEvents || []).forEach((ev: any) => {
    if (!seen.has(ev.order_id)) { seen.add(ev.order_id); orderIds.push(ev.order_id); }
  });

  if (orderIds.length === 0) {
    return { revenue: 0, cost: 0, profit: 0, materialsCost: 0 };
  }

  const { data: orders } = await supabase
    .from("orders")
    .select("id, quantity, price_cents, material_cost_cents, products:product_id(cost_cents)")
    .in("id", orderIds);

  const { data: items } = await supabase
    .from("order_items")
    .select("order_id, quantity, unit_price_cents, products:product_id(cost_cents)")
    .in("order_id", orderIds);

  const orderIdsWithItems = new Set((items || []).map((it: any) => it.order_id));
  const materialCostByOrder: Record<string, number> = {};
  (orders || []).forEach((o: any) => {
    if (o.material_cost_cents != null) materialCostByOrder[o.id] = o.material_cost_cents;
  });
  const materialCostApplied = new Set<string>();
  let materialsCostCents = 0;

  let revenueCents = 0;
  let costCents = 0;

  (items || []).forEach((it: any) => {
    revenueCents += (it.unit_price_cents || 0) * (it.quantity || 1);
    const orderMaterialCost = materialCostByOrder[it.order_id];
    if (orderMaterialCost != null) {
      if (!materialCostApplied.has(it.order_id)) {
        costCents += orderMaterialCost;
        materialsCostCents += orderMaterialCost;
        materialCostApplied.add(it.order_id);
      }
    } else {
      costCents += (it.products?.cost_cents || 0) * (it.quantity || 1);
    }
  });

  (orders || []).forEach((o: any) => {
    if (orderIdsWithItems.has(o.id)) return;
    revenueCents += o.price_cents || 0;
    if (o.material_cost_cents != null) {
      costCents += o.material_cost_cents;
      materialsCostCents += o.material_cost_cents;
    } else {
      costCents += (o.products?.cost_cents || 0) * (o.quantity || 1);
    }
  });

  return {
    revenue: revenueCents / 100,
    cost: costCents / 100,
    profit: (revenueCents - costCents) / 100,
    materialsCost: materialsCostCents / 100
  };
}

function SummaryBox({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-white border border-[#1E3A5F]/10 rounded-xl p-5">
      <div className="text-xs text-[#1E3A5F]/50 uppercase tracking-wide mb-1">{label}</div>
      <div className={`text-2xl font-display ${color || "text-[#1E3A5F]"}`}>{value}</div>
    </div>
  );
}

export default async function ReportsPage() {
  const supabase = createClient();

  const { data: settings } = await supabase.from("report_settings").select("*").eq("id", 1).maybeSingle();
  const michiganPercent = Number(settings?.michigan_income_tax_percent) || 4.25;
  const federalPercent = Number(settings?.federal_income_tax_percent) || 15.3;

  const { year, month } = easternParts(new Date());
  const quarter = Math.floor((month - 1) / 3);
  const quarterLabel = `Q${quarter + 1} ${year}`;

  const quarterStart = easternMidnightUtc(year, quarter * 3 + 1, 1);
  const now = new Date();
  const yearStart = easternMidnightUtc(year, 1, 1);

  const [quarterTotals, yearTotals] = await Promise.all([
    getPeriodTotals(supabase, quarterStart, now),
    getPeriodTotals(supabase, yearStart, now)
  ]);

  function taxFigures(totals: { revenue: number; profit: number }) {
    const salesTax = totals.revenue - totals.revenue / (1 + SALES_TAX_RATE);
    const michiganTax = totals.profit > 0 ? totals.profit * (michiganPercent / 100) : 0;
    const federalTax = totals.profit > 0 ? totals.profit * (federalPercent / 100) : 0;
    return { salesTax, michiganTax, federalTax };
  }

  const quarterTax = taxFigures(quarterTotals);
  const yearTax = taxFigures(yearTotals);

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="font-display text-2xl text-[#1E3A5F]">Reports</h1>
        <Link
          href="/admin/report-settings"
          className="text-xs font-semibold text-[#1E3A5F] border border-[#1E3A5F]/20 rounded-md px-3 py-1.5 hover:bg-cream"
        >
          Report Settings →
        </Link>
      </div>
      <p className="text-sm text-[#1E3A5F]/60 mb-6">
        Based on orders actually picked up, dated by when they were picked up — same rule used everywhere else.
      </p>

      <h2 className="text-sm font-semibold text-[#1E3A5F]/70 uppercase tracking-wide mb-2">{quarterLabel}</h2>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
        <SummaryBox label="Profit" value={`$${quarterTotals.profit.toFixed(2)}`} color={quarterTotals.profit >= 0 ? "text-sage" : "text-ember"} />
        <SummaryBox label="Pickets used" value={`-$${quarterTotals.materialsCost.toFixed(2)}`} color="text-ember" />
        <SummaryBox label="Sales tax owed (6% MI)" value={`$${quarterTax.salesTax.toFixed(2)}`} color="text-ember" />
        <SummaryBox label={`Michigan income tax (${michiganPercent}%)`} value={`$${quarterTax.michiganTax.toFixed(2)}`} color="text-ember" />
        <SummaryBox label={`Federal income tax (${federalPercent}%)`} value={`$${quarterTax.federalTax.toFixed(2)}`} color="text-ember" />
      </div>

      <h2 className="text-sm font-semibold text-[#1E3A5F]/70 uppercase tracking-wide mb-2">Year to date ({year})</h2>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
        <SummaryBox label="Profit" value={`$${yearTotals.profit.toFixed(2)}`} color={yearTotals.profit >= 0 ? "text-sage" : "text-ember"} />
        <SummaryBox label="Pickets used" value={`-$${yearTotals.materialsCost.toFixed(2)}`} color="text-ember" />
        <SummaryBox label="Sales tax owed (6% MI)" value={`$${yearTax.salesTax.toFixed(2)}`} color="text-ember" />
        <SummaryBox label={`Michigan income tax (${michiganPercent}%)`} value={`$${yearTax.michiganTax.toFixed(2)}`} color="text-ember" />
        <SummaryBox label={`Federal income tax (${federalPercent}%)`} value={`$${yearTax.federalTax.toFixed(2)}`} color="text-ember" />
      </div>

      <p className="text-xs text-[#1E3A5F]/40 mb-6">
        Sales tax and Michigan income tax use real statutory rates. Federal income tax is a planning estimate you
        control in Report Settings. Profit only reflects items with a cost entered in Products, or picket usage
        logged on planter orders. Confirm exact amounts with your tax preparer.
      </p>

      <h2 className="font-display text-lg text-[#1E3A5F] mb-1">Sales by item (detailed PDF)</h2>
      <p className="text-sm text-[#1E3A5F]/60 mb-4">
        See how much of each item sold, and the same tax breakdown, for any custom time period.
      </p>

      <div className="bg-white border border-[#1E3A5F]/10 rounded-xl p-5">
        <div className="flex flex-wrap gap-2">
          <a href="/api/reports/sales-by-item?period=today" className="border border-[#1E3A5F]/20 text-[#1E3A5F] px-3 py-1.5 rounded-md text-xs font-semibold hover:bg-cream">Today</a>
          <a href="/api/reports/sales-by-item?period=this_week" className="border border-[#1E3A5F]/20 text-[#1E3A5F] px-3 py-1.5 rounded-md text-xs font-semibold hover:bg-cream">This week</a>
          <a href="/api/reports/sales-by-item?period=this_month" className="border border-[#1E3A5F]/20 text-[#1E3A5F] px-3 py-1.5 rounded-md text-xs font-semibold hover:bg-cream">This month</a>
          <a href="/api/reports/sales-by-item?period=this_quarter" className="border border-[#1E3A5F]/20 text-[#1E3A5F] px-3 py-1.5 rounded-md text-xs font-semibold hover:bg-cream">This quarter</a>
          <a href="/api/reports/sales-by-item?period=this_year" className="border border-[#1E3A5F]/20 text-[#1E3A5F] px-3 py-1.5 rounded-md text-xs font-semibold hover:bg-cream">This year</a>
          <a href="/api/reports/sales-by-item?period=lifetime" className="border border-[#1E3A5F]/20 text-[#1E3A5F] px-3 py-1.5 rounded-md text-xs font-semibold hover:bg-cream">Lifetime</a>
        </div>
      </div>
    </div>
  );
}
