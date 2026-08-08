"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { OrderScheduleCard, PRIORITY_STYLES, PRIORITY_LABELS } from "@/components/ProductionSchedule";
import { formatCalendarDate } from "@/lib/dateDisplay";
import AdminButton from "@/components/AdminButton";

export default function ProductionDashboard({
  todayStr,
  scheduledToday,
  completedTodayCount,
  remainingTodayCount,
  readiness,
  overdueOrders,
  dueTomorrowOrders,
  highPriorityOrders,
  remainingPickets,
  isPicketsLow,
  lowStockProducts,
  ordersThisWeek,
  revenueThisWeekCents,
  productsBuiltThisWeek
}: {
  todayStr: string;
  scheduledToday: any[];
  completedTodayCount: number;
  remainingTodayCount: number;
  readiness: { ready: boolean; shortages: { materialType: string; shortQuantity: number | null }[] };
  overdueOrders: any[];
  dueTomorrowOrders: any[];
  highPriorityOrders: any[];
  remainingPickets: number;
  isPicketsLow: boolean;
  lowStockProducts: { id: string; name: string; stock_quantity: number; low_stock_threshold: number }[];
  ordersThisWeek: number;
  revenueThisWeekCents: number;
  productsBuiltThisWeek: number;
}) {
  const router = useRouter();
  const [draggingId, setDraggingId] = useState<string | null>(null);

  // Same production-field update route already used by Production
  // Schedule and Cut List Generator — reused directly, not reimplemented.
  async function updateOrder(orderId: string, patch: Record<string, any>) {
    await fetch(`/api/orders/${orderId}/production`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch)
    });
    router.refresh();
  }

  return (
    <div>
      <h1 className="font-display text-2xl text-[#1E3A5F] mb-1">Production Dashboard</h1>
      <p className="text-sm text-[#1E3A5F]/60 mb-6">Your shop floor, at a glance — {formatCalendarDate(todayStr, "long")}</p>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2 mb-8">
        <Link href="/admin/orders"><AdminButton>+ New Order</AdminButton></Link>
        <Link href="/admin/schedule"><AdminButton variant="secondary">Production Schedule</AdminButton></Link>
        <Link href="/admin/cutlist"><AdminButton variant="secondary">Cut List Generator</AdminButton></Link>
        <Link href="/admin/material-planning"><AdminButton variant="secondary">Material Planning</AdminButton></Link>
        <Link href="/admin/pickets"><AdminButton variant="secondary">Inventory</AdminButton></Link>
        <Link href="/admin/products"><AdminButton variant="secondary">Products</AdminButton></Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Today's Production */}
        <Section title="🛠️ Today's Production">
          <div className="grid grid-cols-3 gap-3 mb-4">
            <Stat label="Scheduled" value={String(scheduledToday.length)} />
            <Stat label="Completed" value={String(completedTodayCount)} accent="sage" />
            <Stat label="Remaining" value={String(remainingTodayCount)} accent={remainingTodayCount > 0 ? "amber" : undefined} />
          </div>
          <div className="max-h-80 overflow-y-auto pr-1">
            {scheduledToday.length === 0 ? (
              <EmptyNote text="Nothing scheduled for today." />
            ) : (
              scheduledToday.map(o => (
                <OrderScheduleCard key={o.id} order={o} todayStr={todayStr} draggingId={draggingId} setDraggingId={setDraggingId} updateOrder={updateOrder} />
              ))
            )}
          </div>
        </Section>

        {/* Materials */}
        <Section title="📦 Materials">
          <div className={`rounded-lg p-3 mb-4 border-2 ${readiness.ready ? "bg-sage/10 border-sage" : "bg-ember/10 border-ember"}`}>
            <div className={`text-sm font-bold ${readiness.ready ? "text-sage" : "text-ember"}`}>
              {readiness.ready ? "Materials available — ready to build today" : "Materials short for today"}
            </div>
            {!readiness.ready && (
              <div className="text-xs text-[#1E3A5F]/60 mt-1">
                {readiness.shortages.map(s => `${s.materialType}: short ${s.shortQuantity}`).join(" · ")}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Link href="/admin/material-planning" className="flex-1">
              <AdminButton variant="secondary" className="w-full">Material Planning →</AdminButton>
            </Link>
            <Link href="/admin/cutlist" className="flex-1">
              <AdminButton variant="secondary" className="w-full">Generate Today's Cut List →</AdminButton>
            </Link>
          </div>
        </Section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Build Queue */}
        <Section title="📋 Build Queue">
          <div className="mb-3">
            <div className="text-xs font-semibold text-[#1E3A5F]/50 uppercase tracking-wide mb-1.5">Highest priority ({highPriorityOrders.length})</div>
            {highPriorityOrders.length === 0 ? <EmptyNote text="Nothing marked high priority." /> : (
              <div className="space-y-1.5">
                {highPriorityOrders.slice(0, 5).map(o => <MiniOrderRow key={o.id} order={o} />)}
              </div>
            )}
          </div>
          <div className="mb-3">
            <div className="text-xs font-semibold text-ember uppercase tracking-wide mb-1.5">Overdue ({overdueOrders.length})</div>
            {overdueOrders.length === 0 ? <EmptyNote text="Nothing overdue." /> : (
              <div className="space-y-1.5">
                {overdueOrders.slice(0, 5).map(o => <MiniOrderRow key={o.id} order={o} />)}
              </div>
            )}
          </div>
          <div>
            <div className="text-xs font-semibold text-amber uppercase tracking-wide mb-1.5">Due tomorrow ({dueTomorrowOrders.length})</div>
            {dueTomorrowOrders.length === 0 ? <EmptyNote text="Nothing due tomorrow." /> : (
              <div className="space-y-1.5">
                {dueTomorrowOrders.slice(0, 5).map(o => <MiniOrderRow key={o.id} order={o} />)}
              </div>
            )}
          </div>
        </Section>

        {/* Inventory */}
        <Section title="📉 Inventory">
          <div className="mb-4">
            <div className="text-xs font-semibold text-[#1E3A5F]/50 uppercase tracking-wide mb-1.5">Low-stock materials</div>
            <div className={`flex items-center justify-between rounded-lg p-3 ${isPicketsLow ? "bg-ember/10" : "bg-sage/10"}`}>
              <span className="text-sm text-[#1E3A5F]">Cedar pickets</span>
              <span className={`text-sm font-bold ${isPicketsLow ? "text-ember" : "text-sage"}`}>{remainingPickets} remaining</span>
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold text-[#1E3A5F]/50 uppercase tracking-wide mb-1.5">Low-stock products ({lowStockProducts.length})</div>
            {lowStockProducts.length === 0 ? <EmptyNote text="Everything's well stocked." /> : (
              <div className="space-y-1.5">
                {lowStockProducts.slice(0, 6).map(p => (
                  <div key={p.id} className="flex items-center justify-between text-sm bg-ember/5 rounded-md px-3 py-1.5">
                    <Link href="/admin/products" className="text-[#1E3A5F] hover:underline">{p.name}</Link>
                    <span className="text-ember font-semibold">{p.stock_quantity} left</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Section>
      </div>

      {/* Business Summary */}
      <Section title="📊 Business Summary (this week)">
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Orders this week" value={String(ordersThisWeek)} />
          <Stat label="Revenue this week" value={`$${(revenueThisWeekCents / 100).toFixed(2)}`} accent="sage" />
          <Stat label="Products built this week" value={String(productsBuiltThisWeek)} />
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-[#1E3A5F]/10 rounded-xl shadow-sm p-4 mb-6">
      <h2 className="font-display text-base text-[#1E3A5F] mb-3">{title}</h2>
      {children}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: "sage" | "amber" | "ember" }) {
  const colorClass = accent === "sage" ? "text-sage" : accent === "amber" ? "text-amber" : accent === "ember" ? "text-ember" : "text-[#1E3A5F]";
  return (
    <div className="bg-cream/40 border border-[#1E3A5F]/10 rounded-lg p-3 text-center">
      <div className={`text-xl font-display ${colorClass}`}>{value}</div>
      <div className="text-[10px] text-[#1E3A5F]/50 uppercase tracking-wide">{label}</div>
    </div>
  );
}

function EmptyNote({ text }: { text: string }) {
  return <p className="text-xs text-[#1E3A5F]/40 italic">{text}</p>;
}

function MiniOrderRow({ order }: { order: any }) {
  return (
    <div className="flex items-center justify-between text-sm bg-cream/40 rounded-md px-3 py-1.5">
      <Link href={`/admin/orders/${order.id}`} className="text-[#1E3A5F] hover:underline truncate">
        {order.profiles?.full_name || "Unknown"} — {order.title}
      </Link>
      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ml-2 ${PRIORITY_STYLES[order.priority || "normal"]}`}>
        {PRIORITY_LABELS[order.priority || "normal"]}
      </span>
    </div>
  );
}
