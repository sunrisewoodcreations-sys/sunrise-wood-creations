import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import YearOverYearReport from "@/components/YearOverYearReport";
import type { SaleRow } from "@/lib/yoy";

export const dynamic = "force-dynamic";

const etDate = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));

export default async function YearOverYearPage() {
  const supabase = createClient();
  const today = etDate(new Date().toISOString());

  const [{ data: pickups }, { data: orders }, { data: items }] = await Promise.all([
    supabase.from("order_status_history").select("order_id, created_at").eq("status", "picked_up").order("created_at", { ascending: true }),
    supabase.from("orders").select("id, created_at, price_cents, quantity, material_cost_cents, products:product_id(cost_cents)").eq("is_demo", false),
    supabase.from("order_items").select("order_id, quantity, unit_price_cents, material_cost_cents, products:product_id(cost_cents)")
  ]);

  // Same per-order revenue/cost rules the main Reports page uses.
  const itemsByOrder = new Map<string, any[]>();
  (items || []).forEach((it: any) => {
    if (!itemsByOrder.has(it.order_id)) itemsByOrder.set(it.order_id, []);
    itemsByOrder.get(it.order_id)!.push(it);
  });
  const money = new Map<string, { revenueCents: number; costCents: number; placed: string }>();
  (orders || []).forEach((o: any) => {
    const its = itemsByOrder.get(o.id);
    let revenueCents = 0, costCents = 0;
    if (its && its.length > 0) {
      its.forEach((it: any) => {
        revenueCents += (it.unit_price_cents || 0) * (it.quantity || 1);
        costCents += it.material_cost_cents != null ? it.material_cost_cents : (it.products?.cost_cents || 0) * (it.quantity || 1);
      });
    } else {
      revenueCents = o.price_cents || 0;
      costCents = o.material_cost_cents != null ? o.material_cost_cents : (o.products?.cost_cents || 0) * (o.quantity || 1);
    }
    money.set(o.id, { revenueCents, costCents, placed: etDate(o.created_at) });
  });

  // Counted when the order was picked up / delivered (matches the main Reports page).
  const seen = new Set<string>();
  const pickedUp: SaleRow[] = [];
  (pickups || []).forEach((ev: any) => {
    const m = money.get(ev.order_id);
    if (!m || seen.has(ev.order_id)) return;
    seen.add(ev.order_id);
    pickedUp.push({ date: etDate(ev.created_at), revenueCents: m.revenueCents, costCents: m.costCents });
  });
  // Or counted the day the order was placed.
  const placed: SaleRow[] = Array.from(money.values()).map(m => ({ date: m.placed, revenueCents: m.revenueCents, costCents: m.costCents }));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <h1 className="font-display text-2xl text-[#1E3A5F]">This year vs last year</h1>
        <Link href="/admin/reports" className="border border-[#1E3A5F]/30 text-[#1E3A5F] px-3 py-1.5 rounded-md text-xs font-semibold">← Reports</Link>
      </div>
      <p className="text-sm text-[#1E3A5F]/60 mb-6">Your sales so far this year next to the exact same dates last year, by month and by week.</p>
      <h2 className="font-display text-lg text-[#1E3A5F] mb-1">Sales by size: this year vs last year (PDF)</h2>
      <p className="text-sm text-[#1E3A5F]/60 mb-4">
        Pick your dates. The PDF shows each planter size next to the same dates last year, and whether it went up or down.
      </p>
      <form method="get" action="/api/reports/planter-comparison" className="bg-white border border-[#1E3A5F]/10 rounded-xl shadow-sm p-5 mb-8 flex flex-wrap items-end gap-4">
        <label className="text-xs text-[#1E3A5F]/60">
          <span className="block mb-1">From</span>
          <input type="date" name="start" required defaultValue={`${today.slice(0, 4)}-01-01`} className="border border-[#1E3A5F]/20 rounded-md px-2 py-1.5 text-sm text-[#1E3A5F]" />
        </label>
        <label className="text-xs text-[#1E3A5F]/60">
          <span className="block mb-1">To</span>
          <input type="date" name="end" required defaultValue={today} className="border border-[#1E3A5F]/20 rounded-md px-2 py-1.5 text-sm text-[#1E3A5F]" />
        </label>
        <button type="submit" className="bg-[#1E3A5F] text-white px-4 py-2 rounded-md text-xs font-semibold">Download PDF</button>
      </form>

      <YearOverYearReport today={today} pickedUp={pickedUp} placed={placed} />
    </div>
  );
}
