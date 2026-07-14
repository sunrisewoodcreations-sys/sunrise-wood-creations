import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { productLabel, statusLabel, statusColor, ProductType } from "@/lib/statusSteps";
import SendInvoiceButton from "@/components/SendInvoiceButton";
import SendStatusEmailButton from "@/components/SendStatusEmailButton";

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

function SummaryCard({
  label, value, color, href
}: { label: string; value: string | number; color?: string; href?: string }) {
  const content = (
    <div className={`bg-white border border-[#1E3A5F]/10 rounded-xl p-5 shadow-sm transition-all ${href ? "hover:shadow-lg hover:border-[#1E3A5F]/30 hover:-translate-y-0.5 cursor-pointer" : ""}`}>
      <div className="text-xs text-[#1E3A5F]/50 uppercase tracking-wide mb-1.5">{label}</div>
      <div className={`text-2xl font-display ${color || "text-[#1E3A5F]"}`}>{value}</div>
    </div>
  );
  if (!href) return content;
  return <Link href={href} className="block">{content}</Link>;
}

function SectionCard({ title, children, emptyText, count }: { title: string; children: React.ReactNode; emptyText?: string; count?: number }) {
  return (
    <div className="bg-white border border-[#1E3A5F]/10 rounded-xl overflow-hidden shadow-sm">
      <div className="px-4 py-3 border-b border-[#1E3A5F]/10 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[#1E3A5F]">{title}</h2>
        {typeof count === "number" && count > 0 && (
          <span className="text-xs font-semibold text-[#1E3A5F]/50">{count}</span>
        )}
      </div>
      <div>{children || <p className="px-4 py-6 text-center text-sm text-[#1E3A5F]/50">{emptyText}</p>}</div>
    </div>
  );
}

const REASON_STYLE: Record<string, { label: string; badge: string }> = {
  overdue: { label: "Overdue", badge: "bg-ember text-white" },
  due_today: { label: "Due today", badge: "bg-amber text-white" },
  waiting_customer: { label: "Waiting on customer", badge: "bg-ember/80 text-white" },
  waiting_payment: { label: "Waiting on payment", badge: "bg-amber/80 text-white" },
  ready_pickup: { label: "Ready for pickup", badge: "bg-sage text-white" }
};

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
  const waitingOnPayment = allOrders.filter(o => o.status !== "picked_up" && (o.amount_paid_cents || 0) < (o.price_cents || 0)).length;
  const overdue = allOrders.filter(o => o.status !== "picked_up" && o.due_date && o.due_date < todayStr).length;

  const pickedUpOrderIdsThisMonth = new Set((pickupEventsThisMonth || []).map((e: any) => e.order_id));
  const salesThisMonthCents = allOrders
    .filter(o => pickedUpOrderIdsThisMonth.has(o.id))
    .reduce((sum, o) => sum + (o.price_cents || 0), 0);

  const remainingPickets = (picketPurchases || []).reduce((sum: number, p: any) => sum + (p.remaining_quantity || 0), 0);

  // --- "Needs your attention" — one entry per order, tagged with its
  // single highest-priority reason (an order that's both overdue and
  // unpaid shows once, as "Overdue" — the most urgent reason only). ---
  const PRIORITY_ORDER = ["overdue", "due_today", "waiting_customer", "waiting_payment", "ready_pickup"];
  function attentionReason(o: any): string | null {
    if (o.status !== "picked_up" && o.due_date && o.due_date < todayStr) return "overdue";
    if (o.status !== "picked_up" && o.due_date === todayStr) return "due_today";
    if (waitingOnCustomerOrderIds.has(o.id)) return "waiting_customer";
    if (o.status !== "picked_up" && (o.amount_paid_cents || 0) < (o.price_cents || 0)) return "waiting_payment";
    if (o.status === "ready_for_pickup") return "ready_pickup";
    return null;
  }
  const attentionItems = allOrders
    .map(o => ({ order: o, reason: attentionReason(o) }))
    .filter((x): x is { order: any; reason: string } => x.reason !== null)
    .sort((a, b) => PRIORITY_ORDER.indexOf(a.reason) - PRIORITY_ORDER.indexOf(b.reason));
  const attentionShown = attentionItems.slice(0, 12);

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
    <div>
      <h1 className="font-display text-2xl text-[#1E3A5F] mb-1">Dashboard</h1>
      <p className="text-sm text-[#1E3A5F]/60 mb-6">Your daily command center — today's priorities first.</p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
        <SummaryCard label="New orders" value={newOrders} href="/admin/orders" />
        <SummaryCard label="In production" value={inProduction} href="/admin/orders" />
        <SummaryCard label="Ready for pickup" value={readyForPickup} color="text-sage" href="/admin/orders?filter=ready_pickup" />
        <SummaryCard label="Waiting on customer" value={waitingOnCustomer} color={waitingOnCustomer > 0 ? "text-ember" : undefined} href="/admin/orders?filter=waiting_customer" />
        <SummaryCard label="Waiting on payment" value={waitingOnPayment} color={waitingOnPayment > 0 ? "text-ember" : undefined} href="/admin/orders?filter=waiting_payment" />
        <SummaryCard label="Overdue" value={overdue} color={overdue > 0 ? "text-ember" : "text-sage"} />
        <SummaryCard label="Sales this month" value={`$${(salesThisMonthCents / 100).toFixed(2)}`} color="text-sage" href="/admin/reports" />
        <SummaryCard label="Cedar pickets remaining" value={remainingPickets} href="/admin/pickets" />
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

      {/* Needs your attention — the actual daily priority list, sorted
          overdue first, then due today, waiting on customer, waiting on
          payment, and finally ready for pickup. */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-display text-lg text-[#1E3A5F]">Needs your attention</h2>
          {attentionItems.length > attentionShown.length && (
            <Link href="/admin/orders" className="text-xs font-semibold text-ember hover:underline">
              +{attentionItems.length - attentionShown.length} more — view all in Orders
            </Link>
          )}
        </div>
        <div className="bg-white border border-[#1E3A5F]/10 rounded-xl overflow-hidden shadow-sm">
          {attentionShown.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-[#1E3A5F]/50">Nothing needs your attention right now — nice.</p>
          )}
          {attentionShown.map(({ order: o, reason }) => {
            const style = REASON_STYLE[reason];
            const balanceCents = (o.price_cents || 0) - (o.amount_paid_cents || 0);
            return (
              <Link
                key={o.id}
                href={`/admin/orders/${o.id}`}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-3 border-t border-[#1E3A5F]/10 first:border-0 hover:bg-cream/60 transition-colors"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-[#1E3A5F] truncate">
                    {productLabel(o.product_type as ProductType)} — {o.title}
                  </div>
                  <div className="text-xs text-[#1E3A5F]/60">
                    {o.profiles?.full_name}
                    {o.due_date && ` · Due ${new Date(o.due_date + "T00:00:00").toLocaleDateString()}`}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {balanceCents > 0 && reason === "waiting_payment" && (
                    <span className="text-xs font-semibold text-ember">${(balanceCents / 100).toFixed(2)} due</span>
                  )}
                  <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${style.badge}`}>
                    {style.label}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

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
                  {o.profiles?.full_name}
                  {o.due_date && ` · Due ${new Date(o.due_date + "T00:00:00").toLocaleDateString()}`}
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
        <SectionCard title="Recent messages" emptyText="No conversations yet.">
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

        <SectionCard title="Recent quote requests" emptyText="No quote requests yet.">
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

        <SectionCard title="Low inventory alerts" emptyText="Everything's well stocked.">
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
