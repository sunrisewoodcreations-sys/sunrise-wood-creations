import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { productLabel, statusLabel, statusColor, ProductType } from "@/lib/statusSteps";
import { formatCalendarDate } from "@/lib/dateDisplay";

// Same Eastern-time-safe "today" calculation already used on the
// Dashboard and Orders pages — replacing this file's old
// `new Date().toISOString().slice(0,10)`, which used the server's UTC
// clock and could silently show the wrong "today" in the evening
// Eastern time (a real latent bug fixed as part of this rebuild).
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

function QueueSection({ emoji, title, orders, todayStr }: { emoji: string; title: string; orders: any[]; todayStr: string }) {
  if (orders.length === 0) return null;
  return (
    <div className="mb-6">
      <h2 className="font-display text-base text-[#1E3A5F] mb-2">{emoji} {title} ({orders.length})</h2>
      <div className="overflow-x-auto bg-white border border-[#1E3A5F]/10 rounded-xl shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#1E3A5F] text-white text-xs uppercase tracking-wide">
              <th className="text-left px-4 py-3">Order</th>
              <th className="text-left px-4 py-3">Customer</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Estimated pickup date</th>
              <th className="text-right px-4 py-3">Balance due</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order: any) => {
              const isOverdue = order.due_date && order.due_date < todayStr;
              const balanceCents = (order.price_cents || 0) - (order.amount_paid_cents || 0);
              return (
                <tr key={order.id} className="border-t border-[#1E3A5F]/10 hover:bg-cream/60">
                  <td className="px-4 py-3">
                    <Link href={`/admin/orders/${order.id}`} className="font-semibold text-[#1E3A5F]">
                      {productLabel(order.product_type as ProductType)} — {order.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-[#1E3A5F]/70">{order.profiles?.full_name}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${statusColor(order.status)}`}>
                      {statusLabel(order.product_type as ProductType, order.status)}
                    </span>
                  </td>
                  <td className={`px-4 py-3 font-mono ${isOverdue ? "text-ember font-semibold" : "text-[#1E3A5F]/70"}`}>
                    {order.due_date
                      ? `${formatCalendarDate(order.due_date)}${isOverdue ? " (overdue)" : ""}`
                      : "—"}
                  </td>
                  <td className={`px-4 py-3 text-right font-semibold ${balanceCents > 0 ? "text-ember" : "text-sage"}`}>
                    ${(balanceCents / 100).toFixed(2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default async function QueuePage() {
  const supabase = createClient();

  const { data: orders } = await supabase
    .from("orders")
    .select("*, profiles:customer_id(full_name)")
    .neq("status", "picked_up");

  const { year, month, day } = easternDateParts(new Date());
  const todayStr = dateStr(year, month, day);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const { year: ty, month: tm, day: td } = easternDateParts(tomorrow);
  const tomorrowStr = dateStr(ty, tm, td);

  // By earliest estimated pickup date first — orders with no date at
  // all sort last within their section, since there's nothing urgent
  // to rank them by.
  function byDueDate(a: any, b: any) {
    if (!a.due_date && !b.due_date) return 0;
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return a.due_date.localeCompare(b.due_date);
  }

  const allOrders = orders || [];

  // Every order lands in exactly one section — this is meant to be read
  // top to bottom as "what do I build next", not a set of overlapping
  // reminders (that's what the Dashboard's Today's Tasks is for).
  const overdue = allOrders.filter(o => o.due_date && o.due_date < todayStr).sort(byDueDate);
  const overdueIds = new Set(overdue.map(o => o.id));

  const buildToday = allOrders.filter(o => !overdueIds.has(o.id) && o.due_date === tomorrowStr).sort(byDueDate);
  const buildTodayIds = new Set(buildToday.map(o => o.id));

  const dueToday = allOrders.filter(o => !overdueIds.has(o.id) && !buildTodayIds.has(o.id) && o.due_date === todayStr).sort(byDueDate);
  const dueTodayIds = new Set(dueToday.map(o => o.id));

  const groupedSoFar = new Set([...overdueIds, ...buildTodayIds, ...dueTodayIds]);
  const inProduction = allOrders
    .filter(o => !groupedSoFar.has(o.id) && o.status !== "order_placed")
    .sort(byDueDate);
  const inProductionIds = new Set(inProduction.map(o => o.id));

  const allGrouped = new Set([...groupedSoFar, ...inProductionIds]);
  const futureOrders = allOrders.filter(o => !allGrouped.has(o.id)).sort(byDueDate);

  const isEmpty = allOrders.length === 0;

  return (
    <div>
      <h1 className="font-display text-2xl text-[#1E3A5F] mb-1">Build queue</h1>
      <p className="text-sm text-[#1E3A5F]/60 mb-6">
        Sorted by production priority — open this each morning to know exactly what to build next.
      </p>

      {isEmpty && (
        <div className="bg-white border border-[#1E3A5F]/10 rounded-xl shadow-sm px-4 py-6 text-center text-sm text-[#1E3A5F]/50">
          Nothing in progress right now.
        </div>
      )}

      <QueueSection emoji="🔴" title="Overdue" orders={overdue} todayStr={todayStr} />
      <QueueSection emoji="🛠️" title="Build Today (pickup tomorrow)" orders={buildToday} todayStr={todayStr} />
      <QueueSection emoji="📅" title="Due Today" orders={dueToday} todayStr={todayStr} />
      <QueueSection emoji="⏳" title="In Production" orders={inProduction} todayStr={todayStr} />
      <QueueSection emoji="📆" title="Future Orders" orders={futureOrders} todayStr={todayStr} />
    </div>
  );
}
