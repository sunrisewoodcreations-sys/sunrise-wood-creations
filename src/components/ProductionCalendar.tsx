"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { productLabel, statusLabel, statusColor, ProductType } from "@/lib/statusSteps";

type Order = {
  id: string;
  title: string;
  product_type: string;
  status: string;
  due_date: string | null;
  price_cents: number;
  amount_paid_cents: number;
  customer_id: string;
  profiles: any;
};

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

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export default function ProductionCalendar({ orders }: { orders: Order[] }) {
  const router = useRouter();
  const today = useMemo(() => easternDateParts(new Date()), []);
  const todayStr = dateStr(today.year, today.month, today.day);

  const [viewYear, setViewYear] = useState(today.year);
  const [viewMonth, setViewMonth] = useState(today.month); // 1-12
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const [error, setError] = useState("");

  const ordersByDate = useMemo(() => {
    const map = new Map<string, Order[]>();
    orders.forEach(o => {
      if (!o.due_date) return;
      const list = map.get(o.due_date) || [];
      list.push(o);
      map.set(o.due_date, list);
    });
    return map;
  }, [orders]);

  const unscheduled = orders.filter(o => !o.due_date);

  // Build a standard 6-row month grid, including the tail end of the
  // previous month and the start of the next so every week is full.
  const gridDays = useMemo(() => {
    const firstOfMonth = new Date(Date.UTC(viewYear, viewMonth - 1, 1, 12));
    const firstWeekday = firstOfMonth.getUTCDay(); // 0=Sun
    const daysInMonth = new Date(Date.UTC(viewYear, viewMonth, 0, 12)).getUTCDate();
    const daysInPrevMonth = new Date(Date.UTC(viewYear, viewMonth - 1, 0, 12)).getUTCDate();

    const days: { year: number; month: number; day: number; inCurrentMonth: boolean }[] = [];

    for (let i = firstWeekday - 1; i >= 0; i--) {
      const month = viewMonth === 1 ? 12 : viewMonth - 1;
      const year = viewMonth === 1 ? viewYear - 1 : viewYear;
      days.push({ year, month, day: daysInPrevMonth - i, inCurrentMonth: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      days.push({ year: viewYear, month: viewMonth, day: d, inCurrentMonth: true });
    }
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
  }, [viewYear, viewMonth]);

  function goToMonth(delta: number) {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m > 12) { m = 1; y++; }
    if (m < 1) { m = 12; y--; }
    setViewMonth(m);
    setViewYear(y);
  }

  async function rescheduleOrder(orderId: string, newDate: string) {
    setError("");
    const res = await fetch(`/api/orders/${orderId}/due-date`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dueDate: newDate })
    });
    if (res.ok) {
      router.refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Couldn't reschedule that order.");
    }
  }

  function handleDrop(e: React.DragEvent, targetDate: string) {
    e.preventDefault();
    setDragOverDate(null);
    const orderId = e.dataTransfer.getData("text/plain");
    if (orderId) rescheduleOrder(orderId, targetDate);
    setDraggingId(null);
  }

  function OrderChip({ order }: { order: Order }) {
    const isOverdue = order.due_date != null && order.due_date < todayStr && order.status !== "picked_up";
    return (
      <div
        draggable
        onDragStart={e => { e.dataTransfer.setData("text/plain", order.id); setDraggingId(order.id); }}
        onDragEnd={() => setDraggingId(null)}
        className={`group relative rounded-md px-1.5 py-1 mb-1 text-[11px] leading-tight cursor-grab active:cursor-grabbing ${
          isOverdue ? "bg-ember/15 border border-ember/40" : "bg-white border border-[#1E3A5F]/15"
        } ${draggingId === order.id ? "opacity-40" : ""}`}
        title={`${order.profiles?.full_name || "Unknown"} — ${productLabel(order.product_type as ProductType)}: ${order.title}`}
      >
        <Link href={`/admin/orders/${order.id}`} className="block truncate font-semibold text-[#1E3A5F] hover:underline">
          {isOverdue && "⚠ "}{order.profiles?.full_name || "Unknown"}
        </Link>
        <div className="flex items-center gap-1 truncate">
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusColor(order.status).split(" ")[0]}`} />
          <span className="text-[#1E3A5F]/60 truncate">{productLabel(order.product_type as ProductType)}</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button onClick={() => goToMonth(-1)} className="border border-[#1E3A5F]/20 text-[#1E3A5F] w-8 h-8 rounded-md text-sm font-semibold hover:bg-cream">‹</button>
          <h2 className="font-display text-lg text-[#1E3A5F] w-44 text-center">{MONTH_NAMES[viewMonth - 1]} {viewYear}</h2>
          <button onClick={() => goToMonth(1)} className="border border-[#1E3A5F]/20 text-[#1E3A5F] w-8 h-8 rounded-md text-sm font-semibold hover:bg-cream">›</button>
        </div>
        <button
          onClick={() => { setViewMonth(today.month); setViewYear(today.year); }}
          className="border border-[#1E3A5F]/20 text-[#1E3A5F] px-3 py-1.5 rounded-md text-xs font-semibold hover:bg-cream"
        >
          Today
        </button>
      </div>

      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 mb-3">{error}</p>}

      {unscheduled.length > 0 && (
        <div
          onDragOver={e => e.preventDefault()}
          className="bg-white border border-[#1E3A5F]/10 rounded-xl shadow-sm p-3 mb-4"
        >
          <div className="text-xs font-semibold text-[#1E3A5F]/50 uppercase tracking-wide mb-2">
            Unscheduled ({unscheduled.length}) — drag onto a day to set a pickup date
          </div>
          <div className="flex flex-wrap gap-2">
            {unscheduled.map(o => (
              <div key={o.id} className="w-40">
                <OrderChip order={o} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white border border-[#1E3A5F]/10 rounded-xl shadow-sm overflow-hidden">
        <div className="grid grid-cols-7 bg-[#1E3A5F] text-white text-xs uppercase tracking-wide">
          {WEEKDAYS.map(w => <div key={w} className="text-center py-2">{w}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {gridDays.map((d, i) => {
            const ds = dateStr(d.year, d.month, d.day);
            const dayOrders = ordersByDate.get(ds) || [];
            const isToday = ds === todayStr;
            const isDragOver = dragOverDate === ds;

            return (
              <div
                key={i}
                onDragOver={e => { e.preventDefault(); setDragOverDate(ds); }}
                onDragLeave={() => setDragOverDate(prev => (prev === ds ? null : prev))}
                onDrop={e => handleDrop(e, ds)}
                className={`min-h-[110px] border-t border-l border-[#1E3A5F]/10 p-1.5 [&:nth-child(7n+1)]:border-l-0 ${
                  !d.inCurrentMonth ? "bg-cream/40" : "bg-white"
                } ${isDragOver ? "bg-sage/10 ring-2 ring-inset ring-sage/40" : ""}`}
              >
                <div className={`text-xs font-semibold mb-1 ${
                  isToday
                    ? "inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#1E3A5F] text-white"
                    : d.inCurrentMonth ? "text-[#1E3A5F]/70" : "text-[#1E3A5F]/30"
                }`}>
                  {d.day}
                </div>
                <div className="overflow-y-auto max-h-24">
                  {dayOrders.map(o => <OrderChip key={o.id} order={o} />)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
