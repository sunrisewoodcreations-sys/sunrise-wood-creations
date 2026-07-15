import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { productLabel, statusLabel, statusColor, ProductType } from "@/lib/statusSteps";
import SendInvoiceButton from "@/components/SendInvoiceButton";
import SendStatusEmailButton from "@/components/SendStatusEmailButton";
import { formatCalendarDate } from "@/lib/dateDisplay";

// Same Eastern-time helpers already duplicated across the other report
// pages in this app — kept local here too, rather than touching any
// shared/other files.
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

// Small hand-written inline icons — no icon library added. Each uses
// currentColor so it inherits whatever text color is passed to it.
function Icon({ name, className }: { name: string; className?: string }) {
  const common = { className, fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, viewBox: "0 0 24 24" };
  switch (name) {
    case "box":
      return <svg {...common}><path d="M21 8l-9-5-9 5 9 5 9-5z" /><path d="M3 8v8l9 5 9-5V8" /><path d="M12 13v8" /></svg>;
    case "hammer":
      return <svg {...common}><path d="M14.5 3.5l6 6L18 12l-6-6 2.5-2.5z" /><path d="M13 8L4 17l3 3 9-9" /></svg>;
    case "check-circle":
      return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M8.5 12.5l2.5 2.5 5-5" /></svg>;
    case "message":
      return <svg {...common}><path d="M21 11.5a8.4 8.4 0 0 1-8.4 8.4 8.3 8.3 0 0 1-3.8-.9L3 21l1.9-5.7a8.3 8.3 0 0 1-.9-3.8A8.4 8.4 0 0 1 12.5 3 8.4 8.4 0 0 1 21 11.5z" /></svg>;
    case "dollar":
      return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 7v10M15 9.5c0-1.4-1.3-2.5-3-2.5s-3 1-3 2.3c0 1.4 1.3 1.9 3 2.2 1.7.3 3 .9 3 2.3 0 1.3-1.3 2.2-3 2.2s-3-1-3-2.4" /></svg>;
    case "clock-alert":
      return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
    case "trending-up":
      return <svg {...common}><path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" /></svg>;
    case "layers":
      return <svg {...common}><path d="M12 3l9 5-9 5-9-5 9-5z" /><path d="M3 13l9 5 9-5" /></svg>;
    default:
      return null;
  }
}

function SummaryCard({
  label, value, subValue, color, href, icon, tint
}: { label: string; value: string | number; subValue?: string; color?: string; href?: string; icon: string; tint: string }) {
  const content = (
    <div className={`bg-white border border-[#1E3A5F]/10 rounded-xl p-5 shadow-sm transition-all ${href ? "hover:shadow-lg hover:border-[#1E3A5F]/30 hover:-translate-y-0.5 cursor-pointer" : ""}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs text-[#1E3A5F]/50 uppercase tracking-wide font-semibold">{label}</div>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${tint}`}>
          <Icon name={icon} className="w-4 h-4" />
        </div>
      </div>
      <div className={`text-3xl font-display font-semibold ${color || "text-[#1E3A5F]"}`}>{value}</div>
      {subValue && <div className="text-xs text-[#1E3A5F]/50 mt-1">{subValue}</div>}
    </div>
  );
  if (!href) return content;
  return <Link href={href} className="block">{content}</Link>;
}

function SectionCard({ title, children, emptyText, emptyIcon, count }: { title: string; children: React.ReactNode; emptyText?: string; emptyIcon?: string; count?: number }) {
  return (
    <div className="bg-white border border-[#1E3A5F]/10 rounded-xl overflow-hidden shadow-sm">
      <div className="px-4 py-3.5 border-b border-[#1E3A5F]/10 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[#1E3A5F]">{title}</h2>
        {typeof count === "number" && count > 0 && (
          <span className="text-xs font-semibold text-[#1E3A5F]/40 bg-[#1E3A5F]/5 px-2 py-0.5 rounded-full">{count}</span>
        )}
      </div>
      <div>
        {children || (
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-8">
            <Icon name={emptyIcon || "layers"} className="w-6 h-6 text-[#1E3A5F]/25" />
            <p className="text-sm text-[#1E3A5F]/50">{emptyText}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// The status-mix legend below combines orders across every product type
// at once, so it needs a label per raw status key that isn't tied to one
// product type's step list (statusLabel() requires a specific type).
const STATUS_MIX_LABELS: Record<string, string> = {
  order_placed: "Order placed",
  deposit_received: "Deposit received",
  design_proof_sent: "Design proof sent",
  design_approved: "Design approved",
  being_assembled: "Being made",
  being_built: "Being built",
  ready_for_pickup: "Ready for pickup",
  picked_up: "Picked up"
};

function TaskSection({
  emoji, title, orders, showBalance
}: { emoji: string; title: string; orders: any[]; showBalance?: boolean }) {
  if (orders.length === 0) return null;
  return (
    <div className="mb-6">
      <h2 className="font-display text-base text-[#1E3A5F] mb-2">{emoji} {title} ({orders.length})</h2>
      <div className="bg-white border border-[#1E3A5F]/10 rounded-xl overflow-hidden shadow-sm">
        {orders.map((o: any) => {
          const balanceCents = (o.price_cents || 0) - (o.amount_paid_cents || 0);
          return (
            <div
              key={o.id}
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-3 border-t border-[#1E3A5F]/10 first:border-0 hover:bg-cream/60 transition-colors"
            >
              <div className="min-w-0">
                <Link href={`/admin/orders/${o.id}`} className="text-sm font-semibold text-[#1E3A5F] truncate hover:underline block">
                  {productLabel(o.product_type as ProductType)} — {o.title}
                </Link>
                <div className="text-xs text-[#1E3A5F]/60">
                  <Link href={`/admin/customers/${o.customer_id}`} className="hover:underline hover:text-[#1E3A5F]">
                    {o.profiles?.full_name}
                  </Link>
                  {o.due_date && ` · Due ${formatCalendarDate(o.due_date)}`}
                </div>
              </div>
              {showBalance && (
                <span className="text-sm font-bold text-ember flex-shrink-0">${(balanceCents / 100).toFixed(2)} due</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const supabase = createClient();
  const { year, month, day } = easternDateParts(new Date());
  const todayStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const [
    { data: orders },
    { data: pendingProofs },
    { data: pickupEventsThisMonth },
    { data: picketPurchases },
    { data: recentMessages },
    { data: recentQuotes },
    { data: products }
  ] = await Promise.all([
    supabase.from("orders").select("*, profiles:customer_id(full_name)").order("created_at", { ascending: false }),
    supabase.from("proofs").select("order_id").eq("status", "pending"),
    supabase.from("order_status_history").select("order_id, created_at").eq("status", "picked_up")
      .gte("created_at", easternMidnightUtc(year, month, 1).toISOString())
      .lt("created_at", easternMidnightUtc(month === 12 ? year + 1 : year, month === 12 ? 1 : month + 1, 1).toISOString()),
    supabase.from("picket_purchases").select("remaining_quantity"),
    supabase.from("order_messages").select("id, order_id, sender_role, body, created_at, orders:order_id(id, title, product_type, customer_id, profiles:customer_id(full_name))").order("created_at", { ascending: false }),
    supabase.from("quote_requests").select("*").order("created_at", { ascending: false }).limit(5),
    supabase.from("products").select("*")
  ]);

  const allOrders = orders || [];

  // --- Summary card calculations ---
  const newOrders = allOrders.filter(o => o.status === "order_placed").length;
  const readyForPickup = allOrders.filter(o => o.status === "ready_for_pickup").length;
  const inProduction = allOrders.filter(o => !["order_placed", "ready_for_pickup", "picked_up"].includes(o.status)).length;
  const waitingOnCustomerOrderIds = new Set((pendingProofs || []).map((p: any) => p.order_id));
  const waitingOnCustomer = waitingOnCustomerOrderIds.size;
  const waitingOnPaymentOrders = allOrders.filter(o => o.status !== "picked_up" && (o.amount_paid_cents || 0) < (o.price_cents || 0));
  const waitingOnPayment = waitingOnPaymentOrders.length;
  const outstandingBalanceCents = waitingOnPaymentOrders.reduce(
    (sum, o) => sum + ((o.price_cents || 0) - (o.amount_paid_cents || 0)),
    0
  );
  const overdue = allOrders.filter(o => o.status !== "picked_up" && o.due_date && o.due_date < todayStr).length;

  // Same "due within the next 7 days" boundary already used on the Orders page.
  const weekFromNow = new Date();
  weekFromNow.setDate(weekFromNow.getDate() + 7);
  const { year: wy, month: wm, day: wd } = easternDateParts(weekFromNow);
  const weekFromNowStr = `${wy}-${String(wm).padStart(2, "0")}-${String(wd).padStart(2, "0")}`;
  const dueThisWeek = allOrders.filter(o => o.status !== "picked_up" && o.due_date && o.due_date >= todayStr && o.due_date <= weekFromNowStr).length;

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const { year: ty, month: tm, day: td } = easternDateParts(tomorrow);
  const tomorrowStr = `${ty}-${String(tm).padStart(2, "0")}-${String(td).padStart(2, "0")}`;

  const pickedUpOrderIdsThisMonth = new Set((pickupEventsThisMonth || []).map((e: any) => e.order_id));
  const salesThisMonthCents = allOrders
    .filter(o => pickedUpOrderIdsThisMonth.has(o.id))
    .reduce((sum, o) => sum + (o.price_cents || 0), 0);

  const remainingPickets = (picketPurchases || []).reduce((sum: number, p: any) => sum + (p.remaining_quantity || 0), 0);
  // No per-business picket threshold exists anywhere yet (unlike products,
  // which have their own configurable low_stock_threshold) — 50 is a
  // reasonable default warning line, using the same red/green convention
  // already used on the Products page. Easy to make configurable later.
  const PICKET_LOW_STOCK_THRESHOLD = 50;
  const isPicketsLow = remainingPickets <= PICKET_LOW_STOCK_THRESHOLD;

  // --- Today's Tasks — six independent checklists, not one combined
  // list. An order can appear in more than one section on purpose (an
  // order that's overdue AND unpaid genuinely needs attention for both
  // reasons) — this is meant to be read like a shop-floor task list,
  // not a single ranked feed. ---
  const overdueOrders = allOrders.filter(o => o.status !== "picked_up" && o.due_date && o.due_date < todayStr);
  // Glue needs at least 24 hours to dry — anything due for pickup
  // tomorrow needs to be built today to be ready in time.
  const buildTodayOrders = allOrders.filter(o => o.status !== "picked_up" && o.due_date === tomorrowStr);
  const dueTodayOrders = allOrders.filter(o => o.status !== "picked_up" && o.due_date === todayStr);
  const readyForPickupOrders = allOrders.filter(o => o.status === "ready_for_pickup");
  const waitingOnCustomerTaskOrders = allOrders.filter(o => waitingOnCustomerOrderIds.has(o.id));
  const outstandingBalanceTaskOrders = waitingOnPaymentOrders;

  const anyTasks =
    overdueOrders.length > 0 ||
    buildTodayOrders.length > 0 ||
    dueTodayOrders.length > 0 ||
    readyForPickupOrders.length > 0 ||
    waitingOnCustomerTaskOrders.length > 0 ||
    outstandingBalanceTaskOrders.length > 0;

  // --- Status mix — a lightweight visual indicator built entirely from
  // data already fetched above, no charting library, no new data. ---
  const activeOrders = allOrders.filter(o => o.status !== "picked_up");
  const statusCounts: Record<string, number> = {};
  activeOrders.forEach(o => { statusCounts[o.status] = (statusCounts[o.status] || 0) + 1; });
  const statusMix = Object.entries(statusCounts).sort((a, b) => b[1] - a[1]);

  const recentOrders = allOrders.slice(0, 8);

  const latestMessageByOrder = new Map<string, any>();
  (recentMessages || []).forEach((m: any) => {
    if (!latestMessageByOrder.has(m.order_id)) latestMessageByOrder.set(m.order_id, m);
  });
  const recentConversations = Array.from(latestMessageByOrder.values()).slice(0, 5);

  const lowInventoryProducts = (products || []).filter((p: any) => (p.stock_quantity ?? 0) <= (p.low_stock_threshold ?? 0));

  return (
    <div className="bg-cream/40 -m-8 p-8 min-h-full">
      <h1 className="font-display text-2xl text-[#1E3A5F] mb-1">Dashboard</h1>
      <p className="text-sm text-[#1E3A5F]/60 mb-6">Your daily command center — today's priorities first.</p>

      {/* Today's Tasks — six independent checklists reflecting how the
          shop actually runs (including the 24-hour glue cure time), not
          one combined ranked feed. This is the first major section on
          the page on purpose, ahead of the summary cards. */}
      <div className="mb-8">
        <h2 className="font-display text-lg text-[#1E3A5F] mb-3">Today's Tasks</h2>

        {!anyTasks && (
          <div className="bg-white border border-[#1E3A5F]/10 rounded-xl overflow-hidden shadow-sm">
            <div className="flex flex-col items-center justify-center gap-3 px-4 py-10">
              <div className="w-12 h-12 rounded-full bg-sage/15 flex items-center justify-center">
                <Icon name="check-circle" className="w-7 h-7 text-sage" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-[#1E3A5F]">You're all caught up</p>
                <p className="text-xs text-[#1E3A5F]/50 mt-0.5">Nothing overdue, unpaid, or waiting on anyone right now.</p>
              </div>
            </div>
          </div>
        )}

        <TaskSection emoji="🔴" title="Overdue Orders" orders={overdueOrders} />
        <TaskSection emoji="🛠️" title="Build Today (pickup tomorrow — glue needs 24hrs)" orders={buildTodayOrders} />
        <TaskSection emoji="📅" title="Due Today" orders={dueTodayOrders} />
        <TaskSection emoji="🚚" title="Ready for Pickup" orders={readyForPickupOrders} />
        <TaskSection emoji="💬" title="Waiting on Customer" orders={waitingOnCustomerTaskOrders} />
        <TaskSection emoji="💰" title="Outstanding Balance" orders={outstandingBalanceTaskOrders} showBalance />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
        <SummaryCard label="New orders" value={newOrders} href="/admin/orders" icon="box" tint="bg-[#1E3A5F]/10 text-[#1E3A5F]" />
        <SummaryCard label="In production" value={inProduction} href="/admin/orders" icon="hammer" tint="bg-amber/20 text-amber" />
        <SummaryCard label="Ready for pickup" value={readyForPickup} color="text-sage" href="/admin/orders?filter=ready_pickup" icon="check-circle" tint="bg-sage/15 text-sage" />
        <SummaryCard label="Due this week" value={dueThisWeek} href="/admin/orders?filter=due_week" icon="clock-alert" tint="bg-amber/20 text-amber" />
        <SummaryCard label="Waiting on customer" value={waitingOnCustomer} color={waitingOnCustomer > 0 ? "text-ember" : undefined} href="/admin/orders?filter=waiting_customer" icon="message" tint="bg-ember/15 text-ember" />
        <SummaryCard
          label="Waiting on payment"
          value={`$${(outstandingBalanceCents / 100).toFixed(2)}`}
          subValue={`${waitingOnPayment} order${waitingOnPayment === 1 ? "" : "s"}`}
          color={outstandingBalanceCents > 0 ? "text-ember" : undefined}
          href="/admin/orders?filter=waiting_payment"
          icon="dollar"
          tint="bg-amber/20 text-amber"
        />
        <SummaryCard label="Overdue" value={overdue} color={overdue > 0 ? "text-ember" : "text-sage"} href="/admin/orders?filter=overdue" icon="clock-alert" tint={overdue > 0 ? "bg-ember/15 text-ember" : "bg-sage/15 text-sage"} />
        <SummaryCard label="Sales this month" value={`$${(salesThisMonthCents / 100).toFixed(2)}`} color="text-sage" href="/admin/reports" icon="trending-up" tint="bg-sage/15 text-sage" />
        <SummaryCard
          label="Cedar pickets remaining"
          value={remainingPickets}
          color={isPicketsLow ? "text-ember" : "text-sage"}
          href="/admin/pickets"
          icon="layers"
          tint={isPicketsLow ? "bg-ember/15 text-ember" : "bg-sage/15 text-sage"}
        />
      </div>

      {/* Lightweight status-mix bar — built entirely from the order data
          already fetched above, no new tables or chart library. */}
      {activeOrders.length > 0 && (
        <div className="bg-white border border-[#1E3A5F]/10 rounded-xl p-4 mb-8 shadow-sm">
          <div className="text-xs text-[#1E3A5F]/50 uppercase tracking-wide mb-2">Active orders by stage ({activeOrders.length})</div>
          <div className="flex h-3 rounded-full overflow-hidden mb-2">
            {statusMix.map(([status, count]) => (
              <div
                key={status}
                className={statusColor(status).split(" ")[0]}
                style={{ width: `${(count / activeOrders.length) * 100}%` }}
                title={`${STATUS_MIX_LABELS[status] || status}: ${count}`}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#1E3A5F]/60">
            {statusMix.map(([status, count]) => (
              <span key={status} className="inline-flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${statusColor(status).split(" ")[0]}`} />
                {STATUS_MIX_LABELS[status] || status} ({count})
              </span>
            ))}
          </div>
        </div>
      )}

      <SectionCard title="Recent orders" count={recentOrders.length}>
        {recentOrders.map(o => {
          const balanceCents = (o.price_cents || 0) - (o.amount_paid_cents || 0);
          return (
            <div key={o.id} className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 px-4 py-3.5 border-t border-[#1E3A5F]/10 first:border-0 hover:bg-cream/40 transition-colors">
              <div className="min-w-0 flex-1">
                <Link href={`/admin/orders/${o.id}`} className="text-sm font-semibold text-[#1E3A5F] hover:underline">
                  {productLabel(o.product_type as ProductType)} — {o.title}
                </Link>
                <div className="text-xs text-[#1E3A5F]/60 mt-0.5">
                  <Link href={`/admin/customers/${o.customer_id}`} className="hover:underline hover:text-[#1E3A5F]">
                    {o.profiles?.full_name}
                  </Link>
                  {o.due_date && ` · Due ${formatCalendarDate(o.due_date)}`}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${statusColor(o.status)}`}>
                  {statusLabel(o.product_type as ProductType, o.status)}
                </span>
                <span className={`text-sm font-bold whitespace-nowrap ${balanceCents > 0 ? "text-ember" : "text-sage"}`}>
                  ${(balanceCents / 100).toFixed(2)} due
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Link
                    href={`/admin/orders/${o.id}`}
                    className="border border-[#1E3A5F] text-[#1E3A5F] px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap"
                  >
                    Open order
                  </Link>
                  <SendInvoiceButton orderId={o.id} />
                  <SendStatusEmailButton orderId={o.id} />
                </div>
              </div>
            </div>
          );
        })}
        {recentOrders.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-[#1E3A5F]/50">No orders yet.</p>
        )}
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <SectionCard title="Recent messages" emptyText="No conversations yet." emptyIcon="message">
          {recentConversations.map((m: any) => {
            const order = m.orders;
            return (
              <Link key={m.order_id} href={`/admin/orders/${m.order_id}`} className="flex items-center justify-between px-4 py-3 border-t border-[#1E3A5F]/10 first:border-0 hover:bg-cream/60 transition-colors">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-[#1E3A5F] truncate">
                    {order?.profiles?.full_name || "Unknown"} — {order ? order.title : "Order"}
                  </div>
                  <div className="text-xs text-[#1E3A5F]/60 truncate">
                    {m.sender_role === "admin" ? "You: " : ""}{m.body}
                  </div>
                </div>
                <div className="text-xs font-mono text-[#1E3A5F]/40 whitespace-nowrap ml-2">
                  {new Date(m.created_at).toLocaleDateString()}
                </div>
              </Link>
            );
          })}
        </SectionCard>

        <SectionCard title="Recent quote requests" emptyText="No quote requests yet." emptyIcon="message">
          {(recentQuotes || []).map((q: any) => (
            <Link key={q.id} href="/admin/quotes" className="flex items-center justify-between px-4 py-3 border-t border-[#1E3A5F]/10 first:border-0 hover:bg-cream/60 transition-colors">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-[#1E3A5F] truncate">{q.name}</div>
                <div className="text-xs text-[#1E3A5F]/60 truncate">{q.description}</div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                {!q.responded && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-ember/20 text-ember">New</span>}
                <div className="text-xs font-mono text-[#1E3A5F]/40 whitespace-nowrap">
                  {new Date(q.created_at).toLocaleDateString()}
                </div>
              </div>
            </Link>
          ))}
        </SectionCard>

        <SectionCard title="Low inventory alerts" emptyText="Everything's well stocked." emptyIcon="box">
          {lowInventoryProducts.map((p: any) => (
            <Link key={p.id} href="/admin/products" className="flex items-center justify-between px-4 py-3 border-t border-[#1E3A5F]/10 first:border-0 hover:bg-cream/60 transition-colors">
              <div className="text-sm font-semibold text-[#1E3A5F]">{p.name}</div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-ember/20 text-ember">
                {p.stock_quantity ?? 0} left
              </span>
            </Link>
          ))}
        </SectionCard>
      </div>
    </div>
  );
}
