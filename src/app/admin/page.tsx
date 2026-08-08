import { createClient } from "@/lib/supabase/server";
import { getTodayReadiness } from "@/lib/materialPlanning";
import ProductionDashboard from "@/components/ProductionDashboard";

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
  // Copied verbatim from the existing Dashboard page — tries both
  // possible UTC offsets for Eastern time (handles DST correctly) and
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

export default async function ProductionDashboardPage() {
  const supabase = createClient();

  const { year, month, day } = easternDateParts(new Date());
  const todayStr = dateStr(year, month, day);
  const tomorrowStr = addDays(todayStr, 1);
  const weekStartStr = addDays(todayStr, -6); // last 7 days including today, matching "this week" at a glance

  const [
    { data: allOrders },
    { data: products },
    { data: picketPurchases },
    { data: pickupEventsThisWeek },
    readiness
  ] = await Promise.all([
    supabase
      .from("orders")
      .select("id, title, product_type, status, production_status, priority, production_date, due_date, price_cents, amount_paid_cents, customer_id, profiles:customer_id(full_name)")
      .neq("status", "picked_up"),
    supabase.from("products").select("id, name, stock_quantity, low_stock_threshold"),
    supabase.from("picket_purchases").select("remaining_quantity"),
    supabase
      .from("order_status_history")
      .select("order_id, created_at")
      .eq("status", "picked_up")
      .gte("created_at", easternMidnightUtc(Number(weekStartStr.slice(0,4)), Number(weekStartStr.slice(5,7)), Number(weekStartStr.slice(8,10))).toISOString()),
    getTodayReadiness(todayStr)
  ]);

  // All orders (including picked-up ones) needed for revenue-this-week,
  // since that query above deliberately excludes picked_up.
  const { data: pickedUpOrdersThisWeek } = await supabase
    .from("orders")
    .select("id, price_cents")
    .in("id", (pickupEventsThisWeek || []).map((e: any) => e.order_id));

  const orders = allOrders || [];
  const remainingPickets = (picketPurchases || []).reduce((sum: number, p: any) => sum + (p.remaining_quantity || 0), 0);
  const PICKET_LOW_STOCK_THRESHOLD = 50; // same constant already used on the existing Dashboard

  const scheduledToday = orders.filter(o => o.production_date === todayStr);
  const completedTodayCount = orders.filter(o => o.production_status === "completed" && o.production_date === todayStr).length;
  const remainingTodayCount = scheduledToday.filter(o => o.production_status !== "completed").length;

  const overdueOrders = orders.filter(o => o.production_date && o.production_date < todayStr && o.production_status !== "completed");
  const dueTomorrowOrders = orders.filter(o => o.due_date === tomorrowStr && o.status !== "picked_up");
  const highPriorityOrders = orders.filter(o => o.priority === "high" && o.production_status !== "completed");

  const lowStockProducts = (products || []).filter((p: any) => (p.stock_quantity ?? 0) <= (p.low_stock_threshold ?? 0));

  const ordersThisWeek = orders.filter(o => o.production_date && o.production_date >= weekStartStr && o.production_date <= todayStr).length
    + (pickedUpOrdersThisWeek || []).length;
  const revenueThisWeekCents = (pickedUpOrdersThisWeek || []).reduce((sum: number, o: any) => sum + (o.price_cents || 0), 0);
  const productsBuiltThisWeek = orders.filter(o => o.production_status === "completed" && o.production_date && o.production_date >= weekStartStr && o.production_date <= todayStr).length;

  return (
    <ProductionDashboard
      todayStr={todayStr}
      scheduledToday={scheduledToday}
      completedTodayCount={completedTodayCount}
      remainingTodayCount={remainingTodayCount}
      readiness={readiness}
      overdueOrders={overdueOrders}
      dueTomorrowOrders={dueTomorrowOrders}
      highPriorityOrders={highPriorityOrders}
      remainingPickets={remainingPickets}
      isPicketsLow={remainingPickets <= PICKET_LOW_STOCK_THRESHOLD}
      lowStockProducts={lowStockProducts}
      ordersThisWeek={ordersThisWeek}
      revenueThisWeekCents={revenueThisWeekCents}
      productsBuiltThisWeek={productsBuiltThisWeek}
    />
  );
}
