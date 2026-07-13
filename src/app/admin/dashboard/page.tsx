import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { productLabel, statusLabel, ProductType } from "@/lib/statusSteps";

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

function SummaryCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="bg-white border border-[#1E3A5F]/10 rounded-xl p-5">
      <div className="text-xs text-[#1E3A5F]/50 uppercase tracking-wide mb-1">{label}</div>
      <div className={`text-2xl font-display ${color || "text-[#1E3A5F]"}`}>{value}</div>
    </div>
  );
}

function SectionCard({ title, children, emptyText }: { title: string; children: React.ReactNode; emptyText?: string }) {
  return (
    <div className="bg-white border border-[#1E3A5F]/10 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-[#1E3A5F]/10">
        <h2 className="text-sm font-semibold text-[#1E3A5F]">{title}</h2>
      </div>
      <div>{children || <p className="px-4 py-6 text-center text-sm text-[#1E3A5F]/50">{emptyText}</p>}</div>
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
  const waitingOnPayment = allOrders.filter(o => o.status !== "picked_up" && (o.amount_paid_cents || 0) < (o.price_cents || 0)).length;
  const overdue = allOrders.filter(o => o.status !== "picked_up" && o.due_date && o.due_date < todayStr).length;

  const pickedUpOrderIdsThisMonth = new Set((pickupEventsThisMonth || []).map((e: any) => e.order_id));
  const salesThisMonthCents = allOrders
    .filter(o => pickedUpOrderIdsThisMonth.has(o.id))
    .reduce((sum, o) => sum + (o.price_cents || 0), 0);

  const remainingPickets = (picketPurchases || []).reduce((sum: number, p: any) => sum + (p.remaining_quantity || 0), 0);

  // --- "Below the cards" section data ---
  const todaysQueue = allOrders.filter(o => o.status !== "picked_up" && o.due_date === todayStr);
  const recentOrders = allOrders.slice(0, 6);

  const latestMessageByOrder = new Map<string, any>();
  (recentMessages || []).forEach((m: any) => {
    if (!latestMessageByOrder.has(m.order_id)) latestMessageByOrder.set(m.order_id, m);
  });
  const recentConversations = Array.from(latestMessageByOrder.values()).slice(0, 6);

  const lowInventoryProducts = (products || []).filter((p: any) => (p.stock_quantity ?? 0) <= (p.low_stock_threshold ?? 0));

  return (
    <div>
      <h1 className="font-display text-2xl text-[#1E3A5F] mb-1">Dashboard</h1>
      <p className="text-sm text-[#1E3A5F]/60 mb-6">Everything that needs your attention, at a glance.</p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <SummaryCard label="New orders" value={newOrders} />
        <SummaryCard label="In production" value={inProduction} />
        <SummaryCard label="Ready for pickup" value={readyForPickup} color="text-sage" />
        <SummaryCard label="Waiting on customer" value={waitingOnCustomer} color={waitingOnCustomer > 0 ? "text-ember" : undefined} />
        <SummaryCard label="Waiting on payment" value={waitingOnPayment} color={waitingOnPayment > 0 ? "text-ember" : undefined} />
        <SummaryCard label="Overdue" value={overdue} color={overdue > 0 ? "text-ember" : "text-sage"} />
        <SummaryCard label="Sales this month" value={`$${(salesThisMonthCents / 100).toFixed(2)}`} color="text-sage" />
        <SummaryCard label="Cedar pickets remaining" value={remainingPickets} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Today's build queue" emptyText="Nothing due today.">
          {todaysQueue.map(o => (
            <Link key={o.id} href={`/admin/orders/${o.id}`} className="flex items-center justify-between px-4 py-3 border-t border-[#1E3A5F]/10 first:border-0 hover:bg-cream/60">
              <div>
                <div className="text-sm font-semibold text-[#1E3A5F]">{productLabel(o.product_type as ProductType)} — {o.title}</div>
                <div className="text-xs text-[#1E3A5F]/60">{(o as any).profiles?.full_name}</div>
              </div>
              <span className="text-xs font-semibold text-ember">Due today</span>
            </Link>
          ))}
        </SectionCard>

        <SectionCard title="Recent orders" emptyText="No orders yet.">
          {recentOrders.map(o => (
            <Link key={o.id} href={`/admin/orders/${o.id}`} className="flex items-center justify-between px-4 py-3 border-t border-[#1E3A5F]/10 first:border-0 hover:bg-cream/60">
              <div>
                <div className="text-sm font-semibold text-[#1E3A5F]">{productLabel(o.product_type as ProductType)} — {o.title}</div>
                <div className="text-xs text-[#1E3A5F]/60">{(o as any).profiles?.full_name} · {statusLabel(o.product_type as ProductType, o.status)}</div>
              </div>
              <div className="text-xs font-mono text-[#1E3A5F]/40 whitespace-nowrap">
                {new Date(o.created_at).toLocaleDateString()}
              </div>
            </Link>
          ))}
        </SectionCard>

        <SectionCard title="Recent messages" emptyText="No conversations yet.">
          {recentConversations.map((m: any) => {
            const order = m.orders;
            return (
              <Link key={m.order_id} href={`/admin/orders/${m.order_id}`} className="flex items-center justify-between px-4 py-3 border-t border-[#1E3A5F]/10 first:border-0 hover:bg-cream/60">
                <div>
                  <div className="text-sm font-semibold text-[#1E3A5F]">
                    {order?.profiles?.full_name || "Unknown"} — {order ? order.title : "Order"}
                  </div>
                  <div className="text-xs text-[#1E3A5F]/60 truncate max-w-xs">
                    {m.sender_role === "admin" ? "You: " : ""}{m.body}
                  </div>
                </div>
                <div className="text-xs font-mono text-[#1E3A5F]/40 whitespace-nowrap">
                  {new Date(m.created_at).toLocaleDateString()}
                </div>
              </Link>
            );
          })}
        </SectionCard>

        <SectionCard title="Recent quote requests" emptyText="No quote requests yet.">
          {(recentQuotes || []).map((q: any) => (
            <Link key={q.id} href="/admin/quotes" className="flex items-center justify-between px-4 py-3 border-t border-[#1E3A5F]/10 first:border-0 hover:bg-cream/60">
              <div>
                <div className="text-sm font-semibold text-[#1E3A5F]">{q.name}</div>
                <div className="text-xs text-[#1E3A5F]/60 truncate max-w-xs">{q.description}</div>
              </div>
              <div className="flex items-center gap-2">
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
            <Link key={p.id} href="/admin/products" className="flex items-center justify-between px-4 py-3 border-t border-[#1E3A5F]/10 first:border-0 hover:bg-cream/60">
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
