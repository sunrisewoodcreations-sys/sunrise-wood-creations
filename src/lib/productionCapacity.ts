import { createAdminClient } from "@/lib/supabase/admin";

export type CapacitySettings = {
  id: string;
  max_hours_per_day: number;
  buffer_minutes_per_day: number;
};

// Single settings row, lazily created with sensible defaults — same
// pattern already used for pickup_availability_settings and
// report_settings elsewhere in this app.
export async function getCapacitySettings(): Promise<CapacitySettings> {
  const admin = createAdminClient();
  const { data: existing } = await admin.from("production_capacity_settings").select("*").limit(1).maybeSingle();
  if (existing) return existing;
  const { data: created } = await admin.from("production_capacity_settings").insert({}).select().single();
  return created!;
}

function addDaysToDateStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

// Usable capacity for a day, after the configured buffer is set aside
// for unexpected delays — the number every workload comparison is
// actually measured against, not the raw configured hours.
export function usableMinutesPerDay(settings: CapacitySettings): number {
  return Math.max(0, settings.max_hours_per_day * 60 - settings.buffer_minutes_per_day);
}

// Total estimated build minutes already committed to a given
// production date — reuses the exact same order_items -> products
// estimated_build_minutes aggregation already used by Manufacturing
// Queue and Production Analytics, not a second calculation of it.
// Completed or already-picked-up orders are excluded: their work is
// done, so they no longer represent a claim on that day's capacity.
export async function getDailyWorkloadMinutes(dateStr: string): Promise<number> {
  const admin = createAdminClient();
  const { data: orders } = await admin
    .from("orders")
    .select("id")
    .eq("production_date", dateStr)
    .neq("status", "picked_up")
    .neq("production_status", "completed");

  const orderIds = (orders || []).map((o: any) => o.id);
  if (orderIds.length === 0) return 0;

  const { data: items } = await admin
    .from("order_items")
    .select("order_id, quantity, products:product_id(estimated_build_minutes)")
    .in("order_id", orderIds);

  return (items || []).reduce((sum: number, it: any) => {
    const perUnit = it.products?.estimated_build_minutes;
    return perUnit != null ? sum + perUnit * (it.quantity || 1) : sum;
  }, 0);
}

export async function isProductionDayBlocked(dateStr: string): Promise<boolean> {
  const admin = createAdminClient();
  // Reuses pickup_blocked_dates directly — a holiday closes both
  // pickup and production, so this is intentionally the same table,
  // not a second one.
  const { data } = await admin.from("pickup_blocked_dates").select("id").eq("blocked_date", dateStr).maybeSingle();
  return !!data;
}

export type DayUtilization = {
  date: string;
  workloadMinutes: number;
  capacityMinutes: number;
  utilizationPercent: number; // capped at 100 for display; can exceed internally via workloadMinutes > capacityMinutes
  isOverbooked: boolean;
  isBlocked: boolean;
};

// Per-day utilization across a date range — the data behind both the
// calendar/graph view and the Dashboard's workload summary. One
// function, reused everywhere a day's busy-ness needs to be shown.
export async function getUtilizationForRange(startDateStr: string, endDateStr: string): Promise<DayUtilization[]> {
  const settings = await getCapacitySettings();
  const capacityMinutes = usableMinutesPerDay(settings);

  const days: string[] = [];
  let cursor = startDateStr;
  while (cursor <= endDateStr) {
    days.push(cursor);
    cursor = addDaysToDateStr(cursor, 1);
  }

  return Promise.all(days.map(async date => {
    const isBlocked = await isProductionDayBlocked(date);
    const workloadMinutes = isBlocked ? 0 : await getDailyWorkloadMinutes(date);
    const utilizationPercent = isBlocked ? 100 : (capacityMinutes > 0 ? Math.round((workloadMinutes / capacityMinutes) * 100) : 0);
    return {
      date,
      workloadMinutes,
      capacityMinutes,
      utilizationPercent: Math.min(100, utilizationPercent),
      isOverbooked: !isBlocked && workloadMinutes > capacityMinutes,
      isBlocked
    };
  }));
}

// Whether a specific day has room for `neededMinutes` more work,
// without going over capacity — the check used both when warning
// about a requested completion date and when searching for the
// earliest realistic one.
export async function checkCapacityForDate(dateStr: string, neededMinutes: number): Promise<{ fits: boolean; currentWorkloadMinutes: number; capacityMinutes: number }> {
  const settings = await getCapacitySettings();
  const capacityMinutes = usableMinutesPerDay(settings);
  const blocked = await isProductionDayBlocked(dateStr);
  if (blocked) return { fits: false, currentWorkloadMinutes: 0, capacityMinutes };

  const currentWorkloadMinutes = await getDailyWorkloadMinutes(dateStr);
  return { fits: currentWorkloadMinutes + neededMinutes <= capacityMinutes, currentWorkloadMinutes, capacityMinutes };
}

// Walks forward day by day (skipping blocked/closed days) until it
// finds the first date with enough remaining capacity for the given
// amount of work — the actual "suggest the next available completion
// date" logic. Capped at a year out as a sane search limit.
export async function findEarliestAvailableDate(neededMinutes: number, notBeforeDateStr: string): Promise<string | null> {
  let cursor = notBeforeDateStr;
  for (let i = 0; i < 365; i++) {
    const check = await checkCapacityForDate(cursor, neededMinutes);
    if (check.fits) return cursor;
    cursor = addDaysToDateStr(cursor, 1);
  }
  return null;
}
