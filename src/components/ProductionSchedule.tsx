"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { productLabel, statusColor, statusLabel, ProductType } from "@/lib/statusSteps";
import { formatCalendarDate } from "@/lib/dateDisplay";

// Same Eastern-time-safe date helpers already used on the Dashboard,
// Calendar, and Queue pages — kept local here too, matching the
// established pattern in this codebase rather than centralizing.
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
function addDays(dateStrVal: string, days: number): string {
  const d = new Date(`${dateStrVal}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const PRODUCT_TYPE_OPTIONS = [
  { value: "", label: "All products" },
  { value: "cornhole", label: "Cornhole boards" },
  { value: "sign", label: "Wooden sign" },
  { value: "planter", label: "Planter box" },
  { value: "cutting_board", label: "Cutting board" }
];

import { PRIORITY_STYLES, PRIORITY_LABELS } from "@/lib/priorityStyles";
export { PRIORITY_STYLES, PRIORITY_LABELS };

export const PRODUCTION_STATUS_STYLES: Record<string, string> = {
  waiting: "bg-[#1E3A5F]/10 text-[#1E3A5F]/60",
  building: "bg-amber/25 text-amber",
  assembly: "bg-amber/50 text-white",
  finishing: "bg-ember/20 text-ember",
  ready_for_pickup: "bg-sage/25 text-sage",
  completed: "bg-sage text-white"
};
export const PRODUCTION_STATUS_LABELS: Record<string, string> = {
  waiting: "Waiting", building: "Building", assembly: "Assembly",
  finishing: "Finishing", ready_for_pickup: "Ready for pickup", completed: "Completed"
};
const PRODUCTION_STATUS_ORDER = ["waiting", "building", "assembly", "finishing", "ready_for_pickup", "completed"];

type Order = any;

export function OrderScheduleCard({
  order, compact, todayStr, draggingId, setDraggingId, updateOrder
}: {
  order: Order; compact?: boolean; todayStr: string;
  draggingId: string | null; setDraggingId: (id: string | null) => void;
  updateOrder: (orderId: string, patch: Record<string, any>) => void;
}) {
    const [editingDetails, setEditingDetails] = useState(false);
    const [notesDraft, setNotesDraft] = useState(order.production_notes || "");
    const [materialWarning, setMaterialWarning] = useState<{ materialType: string; needed: number; onHand: number | null; short: number | null }[] | null>(null);
    const [checkingMaterial, setCheckingMaterial] = useState(false);
    const isOverdue = order.production_date && order.production_date < todayStr && order.production_status !== "completed";

    async function handleStartProduction() {
      setCheckingMaterial(true);
      setMaterialWarning(null);
      try {
        const res = await fetch(`/api/orders/${order.id}/material-check`);
        const data = await res.json();
        if (res.ok && !data.available) {
          setCheckingMaterial(false);
          setMaterialWarning(data.shortages);
          return; // wait for explicit override below, don't start yet
        }
      } catch {
        // If the check itself fails, don't block production over it —
        // fall through and start normally.
      }
      setCheckingMaterial(false);
      updateOrder(order.id, { productionStatus: "building" });
    }

    return (
      <div
        draggable
        onDragStart={e => { e.dataTransfer.setData("text/plain", order.id); setDraggingId(order.id); }}
        onDragEnd={() => setDraggingId(null)}
        className={`bg-white border rounded-lg p-2.5 mb-2 text-xs cursor-grab active:cursor-grabbing ${
          isOverdue ? "border-ember/40 bg-ember/5" : "border-[#1E3A5F]/15"
        } ${draggingId === order.id ? "opacity-40" : ""}`}
      >
        <div className="flex items-center justify-between gap-1 mb-1">
          <Link href={`/admin/orders/${order.id}`} className="font-semibold text-[#1E3A5F] truncate hover:underline">
            {order.profiles?.full_name || "Unknown"}
          </Link>
          <button
            onClick={() => setEditingDetails(s => !s)}
            className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${PRIORITY_STYLES[order.priority || "normal"]}`}
          >
            {PRIORITY_LABELS[order.priority || "normal"]}
          </button>
        </div>
        <div className="text-[#1E3A5F]/60 truncate mb-1.5">{productLabel(order.product_type as ProductType)} — {order.title}</div>
        <span className={`inline-block px-1.5 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${PRODUCTION_STATUS_STYLES[order.production_status || "waiting"]}`}>
          {PRODUCTION_STATUS_LABELS[order.production_status || "waiting"]}
        </span>
        {!compact && order.due_date && (
          <div className="text-[10px] text-[#1E3A5F]/50 mt-1">Pickup: {formatCalendarDate(order.due_date)}</div>
        )}
        {!compact && !editingDetails && order.production_notes && (
          <button onClick={() => setEditingDetails(true)} className="block text-[10px] text-[#1E3A5F]/60 mt-1 italic truncate text-left w-full" title={order.production_notes}>
            “{order.production_notes}”
          </button>
        )}
        {!compact && !editingDetails && !order.production_notes && (
          <button onClick={() => setEditingDetails(true)} className="text-[10px] text-[#1E3A5F]/30 mt-1 italic">+ add note / set priority</button>
        )}

        {!compact && editingDetails && (
          <div className="mt-2 pt-2 border-t border-[#1E3A5F]/10" onClick={e => e.stopPropagation()}>
            <div className="flex gap-1 mb-1.5">
              {(["high", "normal", "low"] as const).map(p => (
                <button
                  key={p}
                  onClick={() => updateOrder(order.id, { priority: p })}
                  className={`flex-1 py-1 rounded text-[10px] font-bold ${order.priority === p ? PRIORITY_STYLES[p] : "bg-[#1E3A5F]/5 text-[#1E3A5F]/40"}`}
                >
                  {PRIORITY_LABELS[p]}
                </button>
              ))}
            </div>
            <textarea
              value={notesDraft}
              onChange={e => setNotesDraft(e.target.value)}
              placeholder="Note for this job..."
              className="w-full border border-[#1E3A5F]/15 rounded-md px-2 py-1 text-xs mb-1.5"
              rows={2}
            />
            <div className="flex gap-1.5">
              <button
                onClick={() => { updateOrder(order.id, { productionNotes: notesDraft }); setEditingDetails(false); }}
                className="flex-1 bg-[#1E3A5F] text-white rounded px-2 py-1 text-[11px] font-semibold"
              >
                Save
              </button>
              <button onClick={() => setEditingDetails(false)} className="flex-1 border border-[#1E3A5F]/20 text-[#1E3A5F] rounded px-2 py-1 text-[11px] font-semibold">
                Cancel
              </button>
            </div>
          </div>
        )}

        {materialWarning && (
          <div className="mt-2 bg-ember/10 border border-ember/30 rounded px-2 py-1.5">
            <div className="text-[10px] font-bold text-ember mb-1">Materials short — start anyway?</div>
            <div className="text-[10px] text-[#1E3A5F]/60 mb-1.5">
              {materialWarning.map(s => `${s.materialType}: short ${s.short}`).join(" · ")}
            </div>
            <div className="flex gap-1.5">
              <button
                onClick={() => { setMaterialWarning(null); updateOrder(order.id, { productionStatus: "building" }); }}
                className="flex-1 bg-ember text-white rounded px-2 py-1 text-[10px] font-semibold"
              >
                Start anyway
              </button>
              <button onClick={() => setMaterialWarning(null)} className="flex-1 border border-[#1E3A5F]/20 text-[#1E3A5F] rounded px-2 py-1 text-[10px] font-semibold">
                Cancel
              </button>
            </div>
          </div>
        )}

        {!compact && order.production_status === "waiting" && (
          <p className="text-[10px] text-[#1E3A5F]/40 italic mt-2">
            Not in the Manufacturing Queue yet — start production here or via a cut list.
          </p>
        )}

        {!compact && (
          <div className="flex gap-1.5 mt-2">
            {order.production_status !== "building" && order.production_status !== "completed" && !materialWarning && (
              <button
                onClick={handleStartProduction}
                disabled={checkingMaterial}
                className="flex-1 bg-[#1E3A5F] text-white rounded px-2 py-1.5 text-[11px] font-semibold disabled:opacity-60"
              >
                {checkingMaterial ? "Checking materials..." : "Start production"}
              </button>
            )}
            {order.production_status !== "completed" && (
              <button
                onClick={() => updateOrder(order.id, { productionStatus: "completed" })}
                className="flex-1 border border-sage text-sage rounded px-2 py-1.5 text-[11px] font-semibold"
              >
                Mark complete
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

export default function ProductionSchedule({
  orders,
  completedOrders,
  waitingOnCustomerOrderIds
}: {
  orders: Order[];
  completedOrders: Order[];
  waitingOnCustomerOrderIds: string[];
}) {
  const router = useRouter();
  const today = useMemo(() => easternDateParts(new Date()), []);
  const todayStr = dateStr(today.year, today.month, today.day);
  const tomorrowStr = addDays(todayStr, 1);

  const [viewMode, setViewMode] = useState<"month" | "week" | "day">("month");
  const [productTypeFilter, setProductTypeFilter] = useState("");
  const [mobileDay, setMobileDay] = useState(todayStr);
  const [desktopDay, setDesktopDay] = useState(todayStr);
  const [calendarYear, setCalendarYear] = useState(today.year);
  const [calendarMonth, setCalendarMonth] = useState(today.month);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [mobileTab, setMobileTab] = useState<"day" | "unscheduled" | "overdue" | "waiting" | "completed">("day");

  const waitingSet = useMemo(() => new Set(waitingOnCustomerOrderIds), [waitingOnCustomerOrderIds]);

  const filteredOrders = useMemo(
    () => orders.filter(o => !productTypeFilter || o.product_type === productTypeFilter),
    [orders, productTypeFilter]
  );

  // --- Curated sections, all reusing the same filtered order list ---
  const overdueOrders = filteredOrders.filter(o => o.production_date && o.production_date < todayStr && o.production_status !== "completed");
  const scheduledToday = filteredOrders.filter(o => o.production_date === todayStr);
  const dueTomorrowPickup = filteredOrders.filter(o => o.due_date === tomorrowStr);
  const waitingOrders = filteredOrders.filter(o => waitingSet.has(o.id));
  const completedTodayCount = completedOrders.filter(o => o.production_date === todayStr).length;

  const ordersByDate = useMemo(() => {
    const map = new Map<string, Order[]>();
    filteredOrders.forEach(o => {
      if (!o.production_date) return;
      const list = map.get(o.production_date) || [];
      list.push(o);
      map.set(o.production_date, list);
    });
    return map;
  }, [filteredOrders]);

  const unscheduled = filteredOrders.filter(o => !o.production_date);

  async function updateOrder(orderId: string, patch: Record<string, any>) {
    setError("");
    const res = await fetch(`/api/orders/${orderId}/production`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch)
    });
    if (res.ok) {
      router.refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Couldn't save that change.");
    }
  }

  function handleDrop(e: React.DragEvent, targetDate: string) {
    e.preventDefault();
    setDragOverDate(null);
    const orderId = e.dataTransfer.getData("text/plain");
    if (orderId) updateOrder(orderId, { productionDate: targetDate });
    setDraggingId(null);
  }

  function goToMonth(delta: number) {
    let m = calendarMonth + delta, y = calendarYear;
    if (m > 12) { m = 1; y++; }
    if (m < 1) { m = 12; y--; }
    setCalendarMonth(m);
    setCalendarYear(y);
  }

  const monthGridDays = useMemo(() => {
    const firstOfMonth = new Date(Date.UTC(calendarYear, calendarMonth - 1, 1, 12));
    const firstWeekday = firstOfMonth.getUTCDay();
    const daysInMonth = new Date(Date.UTC(calendarYear, calendarMonth, 0, 12)).getUTCDate();
    const daysInPrevMonth = new Date(Date.UTC(calendarYear, calendarMonth - 1, 0, 12)).getUTCDate();
    const days: { year: number; month: number; day: number; inCurrentMonth: boolean }[] = [];
    for (let i = firstWeekday - 1; i >= 0; i--) {
      const month = calendarMonth === 1 ? 12 : calendarMonth - 1;
      const year = calendarMonth === 1 ? calendarYear - 1 : calendarYear;
      days.push({ year, month, day: daysInPrevMonth - i, inCurrentMonth: false });
    }
    for (let d = 1; d <= daysInMonth; d++) days.push({ year: calendarYear, month: calendarMonth, day: d, inCurrentMonth: true });
    while (days.length % 7 !== 0 || days.length < 42) {
      const last = days[days.length - 1];
      const nextDay = last.day + 1;
      const daysInThisMonth = new Date(Date.UTC(last.year, last.month, 0, 12)).getUTCDate();
      if (nextDay > daysInThisMonth) {
        const month = last.month === 12 ? 1 : last.month + 1;
        const year = last.month === 12 ? last.year + 1 : last.year;
        days.push({ year, month, day: 1, inCurrentMonth: false });
      } else {
        days.push({ year: last.year, month: last.month, day: nextDay, inCurrentMonth: false });
      }
    }
    return days;
  }, [calendarYear, calendarMonth]);

  const weekGridDays = useMemo(() => {
    const anchor = new Date(`${desktopDay}T12:00:00Z`);
    const weekday = anchor.getUTCDay();
    const days = [];
    for (let i = -weekday; i < 7 - weekday; i++) {
      const d = new Date(anchor);
      d.setUTCDate(d.getUTCDate() + i);
      const { year, month, day } = easternDateParts(d);
      days.push({ year, month, day, ds: dateStr(year, month, day) });
    }
    return days;
  }, [desktopDay]);

  function CapacityDot({ count }: { count: number }) {
    // No real per-day limit exists yet (deliberately deferred) — this
    // is just a soft visual read of "light/moderate/busy" for now.
    // A real limit can plug in here later without changing anything
    // else about this component.
    const color = count === 0 ? "bg-[#1E3A5F]/10" : count <= 2 ? "bg-sage" : count <= 4 ? "bg-amber" : "bg-ember";
    return <span className={`inline-block w-2 h-2 rounded-full ${color}`} title={`${count} job${count === 1 ? "" : "s"} scheduled`} />;
  }


  return (
    <div>
      <h1 className="font-display text-2xl text-[#1E3A5F] mb-1">Production schedule</h1>
      <p className="text-sm text-[#1E3A5F]/60 mb-6">The daily hub for what to build next, in what order, and where it stands.</p>

      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 mb-4">{error}</p>}

      {/* Daily workload summary */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        <div className="bg-white border border-[#1E3A5F]/10 rounded-xl shadow-sm p-4">
          <div className="text-[10px] text-[#1E3A5F]/50 uppercase font-semibold mb-1">Scheduled today</div>
          <div className="text-2xl font-display text-[#1E3A5F]">{scheduledToday.length}</div>
        </div>
        <div className="bg-white border border-[#1E3A5F]/10 rounded-xl shadow-sm p-4">
          <div className="text-[10px] text-[#1E3A5F]/50 uppercase font-semibold mb-1">Overdue</div>
          <div className={`text-2xl font-display ${overdueOrders.length > 0 ? "text-ember" : "text-sage"}`}>{overdueOrders.length}</div>
        </div>
        <div className="bg-white border border-[#1E3A5F]/10 rounded-xl shadow-sm p-4">
          <div className="text-[10px] text-[#1E3A5F]/50 uppercase font-semibold mb-1">Pickup tomorrow</div>
          <div className="text-2xl font-display text-amber">{dueTomorrowPickup.length}</div>
        </div>
        <div className="bg-white border border-[#1E3A5F]/10 rounded-xl shadow-sm p-4">
          <div className="text-[10px] text-[#1E3A5F]/50 uppercase font-semibold mb-1">Waiting on customer</div>
          <div className="text-2xl font-display text-[#1E3A5F]">{waitingOrders.length}</div>
        </div>
        <div className="bg-white border border-[#1E3A5F]/10 rounded-xl shadow-sm p-4">
          <div className="text-[10px] text-[#1E3A5F]/50 uppercase font-semibold mb-1">Completed today</div>
          <div className="text-2xl font-display text-sage">{completedTodayCount}</div>
        </div>
      </div>

      {/* Overdue — always visible until rescheduled, not tucked behind a tab */}
      {overdueOrders.length > 0 && (
        <div className="mb-6">
          <h2 className="font-display text-base text-ember mb-2">🔴 Overdue — needs rescheduling ({overdueOrders.length})</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {overdueOrders.map(o => <OrderScheduleCard key={o.id} order={o} todayStr={todayStr} draggingId={draggingId} setDraggingId={setDraggingId} updateOrder={updateOrder} />)}
          </div>
        </div>
      )}

      {/* Desktop: filters + view toggle */}
      <div className="hidden md:flex items-center gap-3 mb-4">
        <select value={productTypeFilter} onChange={e => setProductTypeFilter(e.target.value)} className="border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm">
          {PRODUCT_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select disabled className="border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm text-[#1E3A5F]/40" title="Employee assignment coming soon">
          <option>All employees</option>
        </select>
        <div className="flex-1" />
        <div className="flex rounded-md border border-[#1E3A5F]/20 overflow-hidden">
          {(["day", "week", "month"] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-3 py-1.5 text-xs font-semibold capitalize ${viewMode === mode ? "bg-[#1E3A5F] text-white" : "text-[#1E3A5F] hover:bg-cream"}`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Desktop calendar views */}
      <div className="hidden md:block">
        {viewMode === "month" && (
          <>
            <div className="flex items-center gap-3 mb-3">
              <button onClick={() => goToMonth(-1)} className="border border-[#1E3A5F]/20 w-8 h-8 rounded-md text-sm font-semibold hover:bg-cream">‹</button>
              <h3 className="font-display text-base text-[#1E3A5F] w-40 text-center">{MONTH_NAMES[calendarMonth - 1]} {calendarYear}</h3>
              <button onClick={() => goToMonth(1)} className="border border-[#1E3A5F]/20 w-8 h-8 rounded-md text-sm font-semibold hover:bg-cream">›</button>
            </div>
            <div className="bg-white border border-[#1E3A5F]/10 rounded-xl shadow-sm overflow-hidden">
              <div className="grid grid-cols-7 bg-[#1E3A5F] text-white text-xs uppercase tracking-wide">
                {WEEKDAYS.map(w => <div key={w} className="text-center py-2">{w}</div>)}
              </div>
              <div className="grid grid-cols-7">
                {monthGridDays.map((d, i) => {
                  const ds = dateStr(d.year, d.month, d.day);
                  const dayOrders = ordersByDate.get(ds) || [];
                  const isToday = ds === todayStr;
                  return (
                    <div
                      key={i}
                      onDragOver={e => { e.preventDefault(); setDragOverDate(ds); }}
                      onDrop={e => handleDrop(e, ds)}
                      className={`min-h-[120px] border-t border-l border-[#1E3A5F]/10 p-1.5 [&:nth-child(7n+1)]:border-l-0 ${
                        !d.inCurrentMonth ? "bg-cream/40" : "bg-white"
                      } ${dragOverDate === ds ? "bg-sage/10 ring-2 ring-inset ring-sage/40" : ""}`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-xs font-semibold ${isToday ? "inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#1E3A5F] text-white" : d.inCurrentMonth ? "text-[#1E3A5F]/70" : "text-[#1E3A5F]/30"}`}>
                          {d.day}
                        </span>
                        {dayOrders.length > 0 && <CapacityDot count={dayOrders.length} />}
                      </div>
                      <div className="overflow-y-auto max-h-24">
                        {dayOrders.map(o => <OrderScheduleCard key={o.id} order={o} compact todayStr={todayStr} draggingId={draggingId} setDraggingId={setDraggingId} updateOrder={updateOrder} />)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {viewMode === "week" && (
          <>
            <div className="flex items-center gap-3 mb-3">
              <button onClick={() => setDesktopDay(addDays(desktopDay, -7))} className="border border-[#1E3A5F]/20 w-8 h-8 rounded-md text-sm font-semibold hover:bg-cream">‹</button>
              <h3 className="font-display text-base text-[#1E3A5F]">Week of {formatCalendarDate(weekGridDays[0].ds)}</h3>
              <button onClick={() => setDesktopDay(addDays(desktopDay, 7))} className="border border-[#1E3A5F]/20 w-8 h-8 rounded-md text-sm font-semibold hover:bg-cream">›</button>
            </div>
            <div className="grid grid-cols-7 gap-2">
              {weekGridDays.map(d => {
                const dayOrders = ordersByDate.get(d.ds) || [];
                const isToday = d.ds === todayStr;
                return (
                  <div
                    key={d.ds}
                    onDragOver={e => { e.preventDefault(); setDragOverDate(d.ds); }}
                    onDrop={e => handleDrop(e, d.ds)}
                    className={`bg-white border rounded-xl shadow-sm p-2 min-h-[300px] ${isToday ? "border-[#1E3A5F]" : "border-[#1E3A5F]/10"} ${dragOverDate === d.ds ? "bg-sage/10 ring-2 ring-inset ring-sage/40" : ""}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs font-semibold text-[#1E3A5F]">{WEEKDAYS[new Date(`${d.ds}T12:00:00Z`).getUTCDay()]} {d.month}/{d.day}</div>
                      {dayOrders.length > 0 && <CapacityDot count={dayOrders.length} />}
                    </div>
                    {dayOrders.map(o => <OrderScheduleCard key={o.id} order={o} todayStr={todayStr} draggingId={draggingId} setDraggingId={setDraggingId} updateOrder={updateOrder} />)}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {viewMode === "day" && (
          <>
            <div className="flex items-center gap-3 mb-3">
              <button onClick={() => setDesktopDay(addDays(desktopDay, -1))} className="border border-[#1E3A5F]/20 w-8 h-8 rounded-md text-sm font-semibold hover:bg-cream">‹</button>
              <h3 className="font-display text-base text-[#1E3A5F]">{formatCalendarDate(desktopDay, "long")}</h3>
              <button onClick={() => setDesktopDay(addDays(desktopDay, 1))} className="border border-[#1E3A5F]/20 w-8 h-8 rounded-md text-sm font-semibold hover:bg-cream">›</button>
            </div>
            <div
              onDragOver={e => { e.preventDefault(); setDragOverDate(desktopDay); }}
              onDrop={e => handleDrop(e, desktopDay)}
              className={`bg-white border rounded-xl shadow-sm p-4 max-w-2xl ${dragOverDate === desktopDay ? "bg-sage/10 ring-2 ring-inset ring-sage/40" : "border-[#1E3A5F]/10"}`}
            >
              {(ordersByDate.get(desktopDay) || []).length === 0 && (
                <p className="text-sm text-[#1E3A5F]/50 text-center py-8">Nothing scheduled for this day. Drag an order here.</p>
              )}
              {(ordersByDate.get(desktopDay) || []).map(o => <OrderScheduleCard key={o.id} order={o} todayStr={todayStr} draggingId={draggingId} setDraggingId={setDraggingId} updateOrder={updateOrder} />)}
            </div>
          </>
        )}

        {unscheduled.length > 0 && (
          <div
            onDragOver={e => e.preventDefault()}
            className="mt-4 bg-white border border-[#1E3A5F]/10 rounded-xl shadow-sm p-3"
          >
            <div className="text-xs font-semibold text-[#1E3A5F]/50 uppercase tracking-wide mb-2">
              Unscheduled ({unscheduled.length}) — drag onto a day to assign a production date
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {unscheduled.map(o => <OrderScheduleCard key={o.id} order={o} todayStr={todayStr} draggingId={draggingId} setDraggingId={setDraggingId} updateOrder={updateOrder} />)}
            </div>
          </div>
        )}
      </div>

      {/* Mobile: always a day view with swipe/tap navigation, never a
          shrunk-down month grid, plus tabs for the other sections. */}
      <div className="md:hidden">
        <div className="flex gap-2 overflow-x-auto pb-2 mb-3 -mx-1 px-1">
          {(["day", "unscheduled", "overdue", "waiting", "completed"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setMobileTab(tab)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold capitalize ${
                mobileTab === tab ? "bg-[#1E3A5F] text-white" : "bg-white border border-[#1E3A5F]/15 text-[#1E3A5F]"
              }`}
            >
              {tab === "day" ? "Day view" : tab === "unscheduled" ? "Unscheduled" : tab === "waiting" ? "Waiting on customer" : tab}
            </button>
          ))}
        </div>

        {mobileTab === "day" && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => setMobileDay(addDays(mobileDay, -1))}
                className="border border-[#1E3A5F]/20 w-11 h-11 rounded-md text-lg font-semibold active:bg-cream"
              >
                ‹
              </button>
              <h3 className="font-display text-base text-[#1E3A5F] text-center">
                {mobileDay === todayStr ? "Today" : mobileDay === tomorrowStr ? "Tomorrow" : formatCalendarDate(mobileDay, "long")}
              </h3>
              <button
                onClick={() => setMobileDay(addDays(mobileDay, 1))}
                className="border border-[#1E3A5F]/20 w-11 h-11 rounded-md text-lg font-semibold active:bg-cream"
              >
                ›
              </button>
            </div>
            <div
              onTouchStart={e => { (e.currentTarget as any)._touchStartX = e.touches[0].clientX; }}
              onTouchEnd={e => {
                const startX = (e.currentTarget as any)._touchStartX;
                if (startX == null) return;
                const deltaX = e.changedTouches[0].clientX - startX;
                if (Math.abs(deltaX) > 60) setMobileDay(addDays(mobileDay, deltaX < 0 ? 1 : -1));
              }}
            >
              {(ordersByDate.get(mobileDay) || []).length === 0 ? (
                <div className="bg-white border border-[#1E3A5F]/10 rounded-xl shadow-sm px-4 py-8 text-center text-sm text-[#1E3A5F]/50">
                  Nothing scheduled for this day.
                </div>
              ) : (
                (ordersByDate.get(mobileDay) || []).map(o => <OrderScheduleCard key={o.id} order={o} todayStr={todayStr} draggingId={draggingId} setDraggingId={setDraggingId} updateOrder={updateOrder} />)
              )}
            </div>
          </div>
        )}

        {mobileTab === "unscheduled" && (
          unscheduled.length === 0 ? (
            <div className="bg-white border border-[#1E3A5F]/10 rounded-xl shadow-sm px-4 py-8 text-center text-sm text-[#1E3A5F]/50">
              Everything active has a production date set.
            </div>
          ) : (
            <div>
              <p className="text-xs text-[#1E3A5F]/50 mb-2">Tap "Save" after picking a date on the order page, or use the desktop view to drag onto a day.</p>
              {unscheduled.map(o => (
                <OrderScheduleCard key={o.id} order={o} todayStr={todayStr} draggingId={draggingId} setDraggingId={setDraggingId} updateOrder={updateOrder} />
              ))}
            </div>
          )
        )}
        {mobileTab === "overdue" && (
          overdueOrders.length === 0 ? (
            <div className="bg-white border border-[#1E3A5F]/10 rounded-xl shadow-sm px-4 py-8 text-center text-sm text-[#1E3A5F]/50">Nothing overdue.</div>
          ) : overdueOrders.map(o => <OrderScheduleCard key={o.id} order={o} todayStr={todayStr} draggingId={draggingId} setDraggingId={setDraggingId} updateOrder={updateOrder} />)
        )}
        {mobileTab === "waiting" && (
          waitingOrders.length === 0 ? (
            <div className="bg-white border border-[#1E3A5F]/10 rounded-xl shadow-sm px-4 py-8 text-center text-sm text-[#1E3A5F]/50">Nobody's waiting on a response right now.</div>
          ) : waitingOrders.map(o => <OrderScheduleCard key={o.id} order={o} todayStr={todayStr} draggingId={draggingId} setDraggingId={setDraggingId} updateOrder={updateOrder} />)
        )}
        {mobileTab === "completed" && (
          completedOrders.length === 0 ? (
            <div className="bg-white border border-[#1E3A5F]/10 rounded-xl shadow-sm px-4 py-8 text-center text-sm text-[#1E3A5F]/50">Nothing marked complete yet.</div>
          ) : completedOrders.slice(0, 20).map(o => <OrderScheduleCard key={o.id} order={o} todayStr={todayStr} draggingId={draggingId} setDraggingId={setDraggingId} updateOrder={updateOrder} />)
        )}
      </div>

      {/* Desktop: Waiting on Customer + Completed, always visible below the calendar */}
      <div className="hidden md:grid grid-cols-2 gap-6 mt-6">
        <div>
          <h2 className="font-display text-base text-[#1E3A5F] mb-2">💬 Waiting on Customer ({waitingOrders.length})</h2>
          <div className="bg-white border border-[#1E3A5F]/10 rounded-xl shadow-sm p-3 max-h-96 overflow-y-auto">
            {waitingOrders.length === 0 ? (
              <p className="text-sm text-[#1E3A5F]/50 text-center py-4">Nobody's waiting on a response right now.</p>
            ) : waitingOrders.map(o => <OrderScheduleCard key={o.id} order={o} compact todayStr={todayStr} draggingId={draggingId} setDraggingId={setDraggingId} updateOrder={updateOrder} />)}
          </div>
        </div>
        <div>
          <h2 className="font-display text-base text-[#1E3A5F] mb-2">✅ Completed ({completedOrders.length})</h2>
          <div className="bg-white border border-[#1E3A5F]/10 rounded-xl shadow-sm p-3 max-h-96 overflow-y-auto">
            {completedOrders.length === 0 ? (
              <p className="text-sm text-[#1E3A5F]/50 text-center py-4">Nothing marked complete yet.</p>
            ) : completedOrders.slice(0, 20).map(o => <OrderScheduleCard key={o.id} order={o} compact todayStr={todayStr} draggingId={draggingId} setDraggingId={setDraggingId} updateOrder={updateOrder} />)}
          </div>
        </div>
      </div>
    </div>
  );
}
