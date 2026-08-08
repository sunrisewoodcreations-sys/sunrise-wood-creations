import { createClient } from "@/lib/supabase/server";
import ProductionAnalytics from "@/components/ProductionAnalytics";

// Same Eastern-time-safe date helpers already duplicated the same way
// in every other page that needs them (Dashboard, Production Dashboard,
// Material Planning, Manufacturing Queue) — following the established
// convention in this codebase rather than introducing a new shared
// utility file at this point.
function easternDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", year: "numeric", month: "numeric", day: "numeric"
  }).formatToParts(date);
  return {
    year: Number(parts.find(p => p.type === "year")?.value),
    month: Number(parts.find(p => p.type === "month")?.value),
    day: Number(parts.find(p => p.type === "day")?.value)
  };
}
function dateStr(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
function addDays(ds: string, days: number): string {
  const [y, m, d] = ds.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}
function easternMidnightUtc(year: number, month: number, day: number): Date {
  // Copied verbatim from the existing Dashboard / Production Dashboard —
  // tries both possible UTC offsets for Eastern time (handles DST) and
  // verifies which one actually lands on local midnight.
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
function toUtcIso(ds: string): string {
  const [y, m, d] = ds.split("-").map(Number);
  return easternMidnightUtc(y, m, d).toISOString();
}

export default async function ProductionAnalyticsPage({
  searchParams
}: {
  searchParams: { range?: string; start?: string; end?: string };
}) {
  const supabase = createClient();

  const { year, month, day } = easternDateParts(new Date());
  const todayStr = dateStr(year, month, day);
  const weekStartStr = addDays(todayStr, -6);
  const monthStartStr = dateStr(year, month, 1);
  const yearStartStr = dateStr(year, 1, 1);

  const range = searchParams.range || "today";
  let startDateStr = todayStr;
  let endDateStr = todayStr;
  let rangeLabel = "Today";
  if (range === "week") { startDateStr = weekStartStr; endDateStr = todayStr; rangeLabel = "This Week"; }
  else if (range === "month") { startDateStr = monthStartStr; endDateStr = todayStr; rangeLabel = "This Month"; }
  else if (range === "year") { startDateStr = yearStartStr; endDateStr = todayStr; rangeLabel = "This Year"; }
  else if (range === "custom" && searchParams.start && searchParams.end) {
    startDateStr = searchParams.start; endDateStr = searchParams.end; rangeLabel = `${searchParams.start} to ${searchParams.end}`;
  }

  // "Completed" reuses the exact same definition the workflow engine
  // already established: workflow stage "completed" is status ===
  // "picked_up" (see getWorkflowStage in lib/workflow.ts) — this page
  // doesn't invent a separate notion of "done".
  //
  // Every pickup event ever is fetched once, then bucketed into
  // today/week/month/year/all-time/selected-range in JS below — rather
  // than five-plus separate date-filtered queries against the same
  // underlying data.
  const { data: allPickupEvents } = await supabase
    .from("order_status_history")
    .select("order_id, created_at")
    .eq("status", "picked_up")
    .order("created_at", { ascending: false });

  const todayIso = toUtcIso(todayStr);
  const weekIso = toUtcIso(weekStartStr);
  const monthIso = toUtcIso(monthStartStr);
  const yearIso = toUtcIso(yearStartStr);
  const rangeStartIso = toUtcIso(startDateStr);
  const rangeEndIso = toUtcIso(addDays(endDateStr, 1));

  const uniqueOrderIdsSince = (isoThreshold: string) =>
    new Set((allPickupEvents || []).filter((e: any) => e.created_at >= isoThreshold).map((e: any) => e.order_id));

  const orderIdsToday = uniqueOrderIdsSince(todayIso);
  const orderIdsWeek = uniqueOrderIdsSince(weekIso);
  const orderIdsMonth = uniqueOrderIdsSince(monthIso);
  const orderIdsYear = uniqueOrderIdsSince(yearIso);
  const orderIdsAllTime = new Set((allPickupEvents || []).map((e: any) => e.order_id));
  const orderIdsInRange = [...new Set(
    (allPickupEvents || [])
      .filter((e: any) => e.created_at >= rangeStartIso && e.created_at < rangeEndIso)
      .map((e: any) => e.order_id)
  )];

  // Every completed order, ever — fetched once, then used both for the
  // fixed-period revenue figures and the selected range's detail below.
  const allCompletedOrderIds = [...orderIdsAllTime];
  const { data: allCompletedOrders } = await supabase
    .from("orders")
    .select("id, price_cents")
    .in("id", allCompletedOrderIds.length > 0 ? allCompletedOrderIds : ["00000000-0000-0000-0000-000000000000"]);

  const priceById = new Map((allCompletedOrders || []).map((o: any) => [o.id, o.price_cents || 0]));
  const revenueForIds = (ids: Set<string> | string[]) => {
    let total = 0;
    for (const id of ids) total += priceById.get(id) || 0;
    return total;
  };

  const [{ data: itemsInRange }, { data: picketUsageInRange }] = await Promise.all([
    supabase.from("order_items").select("order_id, product_id, quantity, unit_price_cents, products:product_id(name, estimated_build_minutes)").in("order_id", orderIdsInRange.length > 0 ? orderIdsInRange : ["00000000-0000-0000-0000-000000000000"]),
    supabase.from("picket_usage_allocations").select("quantity, order_id").in("order_id", orderIdsInRange.length > 0 ? orderIdsInRange : ["00000000-0000-0000-0000-000000000000"])
  ]);

  const revenueCents = revenueForIds(orderIdsInRange);

  let totalBuildMinutes = 0;
  const productStats: Record<string, { name: string; quantity: number; totalMinutes: number; estimatedMinutesPerUnit: number | null; revenueCents: number }> = {};
  (itemsInRange || []).forEach((it: any) => {
    const minutesPerUnit = it.products?.estimated_build_minutes ?? null;
    if (minutesPerUnit != null) totalBuildMinutes += minutesPerUnit * (it.quantity || 1);
    const key = it.product_id || it.products?.name || "unlinked";
    if (!productStats[key]) productStats[key] = { name: it.products?.name || "Unknown product", quantity: 0, totalMinutes: 0, estimatedMinutesPerUnit: minutesPerUnit, revenueCents: 0 };
    productStats[key].quantity += it.quantity || 1;
    productStats[key].revenueCents += (it.unit_price_cents || 0) * (it.quantity || 1);
    if (minutesPerUnit != null) productStats[key].totalMinutes += minutesPerUnit * (it.quantity || 1);
  });

  const allProductStats = Object.values(productStats);
  const mostBuiltByQuantity = [...allProductStats].sort((a, b) => b.quantity - a.quantity).slice(0, 8);
  const mostBuiltByRevenue = [...allProductStats].sort((a, b) => b.revenueCents - a.revenueCents).slice(0, 8);
  const actualPicketsUsed = (picketUsageInRange || []).reduce((sum: number, p: any) => sum + (p.quantity || 0), 0);

  return (
    <ProductionAnalytics
      rangeLabel={rangeLabel}
      currentRange={range}
      customStart={searchParams.start || todayStr}
      customEnd={searchParams.end || todayStr}
      ordersCompletedToday={orderIdsToday.size}
      ordersCompletedWeek={orderIdsWeek.size}
      ordersCompletedMonth={orderIdsMonth.size}
      ordersCompletedYear={orderIdsYear.size}
      ordersCompletedAllTime={orderIdsAllTime.size}
      revenueTodayCents={revenueForIds(orderIdsToday)}
      revenueWeekCents={revenueForIds(orderIdsWeek)}
      revenueMonthCents={revenueForIds(orderIdsMonth)}
      revenueYearCents={revenueForIds(orderIdsYear)}
      revenueAllTimeCents={revenueForIds(orderIdsAllTime)}
      ordersInRangeCount={orderIdsInRange.length}
      totalBuildMinutes={totalBuildMinutes}
      actualPicketsUsed={actualPicketsUsed}
      mostBuiltByQuantity={mostBuiltByQuantity}
      mostBuiltByRevenue={mostBuiltByRevenue}
      revenueCents={revenueCents}
    />
  );
}
