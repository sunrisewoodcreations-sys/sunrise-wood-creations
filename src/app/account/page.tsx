import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import AccountNav from "@/components/AccountNav";
import { productLabel, statusLabel, statusColor, ProductType } from "@/lib/statusSteps";
import { formatCalendarDate } from "@/lib/dateDisplay";
import { formatQuoteNumberWithRevision } from "@/lib/quote";
import { getCustomerTimeline } from "@/lib/orderTimeline";

export default async function AccountDashboardPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();

  const [{ data: orders }, { data: quotes }] = await Promise.all([
    supabase.from("orders").select("*").eq("customer_id", user.id).order("created_at", { ascending: false }),
    supabase.from("quotes").select("*").eq("customer_id", user.id).order("created_at", { ascending: false })
  ]);

  const allOrders = orders || [];
  const currentOrders = allOrders.filter(o => o.status !== "picked_up");
  const completedOrders = allOrders.filter(o => o.status === "picked_up");
  const lifetimeSpendingCents = completedOrders.reduce((sum, o) => sum + (o.price_cents || 0), 0);

  // Only the latest revision of each quote, same rule used everywhere
  // else in the quotes system, and only ones still meaningfully
  // "active" (not already resolved, not expired).
  const latestByLineage = new Map<string, any>();
  (quotes || []).forEach((q: any) => {
    const key = `${q.quote_year}-${q.quote_number}`;
    const existing = latestByLineage.get(key);
    if (!existing || q.revision_number > existing.revision_number) latestByLineage.set(key, q);
  });
  const todayStr = new Date().toISOString().slice(0, 10);
  const activeQuotes = Array.from(latestByLineage.values()).filter(
    (q: any) => !["accepted", "declined"].includes(q.status) && q.expiration_date >= todayStr
  );

  const timeline = await getCustomerTimeline(user.id, allOrders.map(o => ({ id: o.id, title: o.title, product_type: o.product_type })));

  // Simple, derived notifications — not a separate stored system, just
  // read directly off the same quote/order data already being fetched
  // here, so there's nothing new to keep in sync.
  const notifications: { text: string; color: string }[] = [];
  activeQuotes.forEach((q: any) => {
    const daysUntilExpiry = Math.ceil((new Date(q.expiration_date).getTime() - new Date(todayStr).getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntilExpiry <= 2) {
      notifications.push({ text: `Your quote ${formatQuoteNumberWithRevision(q.quote_year, q.quote_number, q.revision_number)} expires in ${daysUntilExpiry} day${daysUntilExpiry === 1 ? "" : "s"}.`, color: "text-ember" });
    }
  });
  Array.from(latestByLineage.values()).forEach((q: any) => {
    if (!["accepted", "declined"].includes(q.status) && q.expiration_date < todayStr) {
      notifications.push({ text: `Your quote ${formatQuoteNumberWithRevision(q.quote_year, q.quote_number, q.revision_number)} has expired.`, color: "text-walnut/60" });
    }
    if (q.status === "accepted") {
      notifications.push({ text: `Your quote ${formatQuoteNumberWithRevision(q.quote_year, q.quote_number, q.revision_number)} has been accepted.`, color: "text-sage" });
    }
  });
  currentOrders.forEach(o => {
    if (["being_built", "being_assembled"].includes(o.status)) {
      notifications.push({ text: `Your order "${o.title}" is now in production.`, color: "text-amber" });
    }
    if (o.status === "ready_for_pickup") {
      notifications.push({ text: `Your order "${o.title}" is ready for pickup!`, color: "text-sage" });
    }
  });
  completedOrders.slice(0, 3).forEach(o => {
    notifications.push({ text: `Your order "${o.title}" has been completed.`, color: "text-sage" });
  });

  return (
    <div className="min-h-screen bg-cream flex flex-col">
      <SiteHeader />
      <div className="max-w-2xl mx-auto px-4 py-10 flex-1 w-full">
        <AccountNav current="/account" />
        <h1 className="font-display text-2xl text-walnut mb-1">Welcome back, {profile?.full_name?.split(" ")[0] || "there"}!</h1>
        <p className="text-sm text-walnut/60 mb-6">Here's everything happening with your account.</p>

        {notifications.length > 0 && (
          <div className="bg-white border border-walnut/10 rounded-xl shadow-sm p-4 mb-6">
            <h2 className="text-xs font-semibold text-walnut/50 uppercase tracking-wide mb-2">Notifications</h2>
            <div className="space-y-1.5">
              {notifications.map((n, i) => (
                <p key={i} className={`text-sm ${n.color}`}>{n.text}</p>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <Stat label="Active Quotes" value={activeQuotes.length} />
          <Stat label="Current Orders" value={currentOrders.length} />
          <Stat label="Completed Orders" value={completedOrders.length} />
          <Stat label="Lifetime Orders" value={allOrders.length} />
        </div>
        <div className="bg-white border border-walnut/10 rounded-xl shadow-sm p-4 mb-6 text-center">
          <div className="text-2xl font-display text-sage">${(lifetimeSpendingCents / 100).toFixed(2)}</div>
          <div className="text-xs text-walnut/50 uppercase tracking-wide">Total lifetime spending</div>
        </div>

        {activeQuotes.length > 0 && (
          <div className="mb-6">
            <h2 className="font-display text-lg text-walnut mb-2">Active Quotes</h2>
            <div className="space-y-2">
              {activeQuotes.map((q: any) => (
                <div key={q.id} className="bg-white border border-walnut/10 rounded-xl shadow-sm p-4 flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div className="font-semibold text-walnut">{formatQuoteNumberWithRevision(q.quote_year, q.quote_number, q.revision_number)}</div>
                    <div className="text-xs text-walnut/50">${(q.total_cents / 100).toFixed(2)} · Expires {new Date(q.expiration_date + "T12:00:00Z").toLocaleDateString()}</div>
                  </div>
                  <div className="flex gap-3 text-xs font-semibold">
                    <a href={`/quote/${q.share_token}`} className="text-walnut hover:underline">View Quote</a>
                    <a href={`/quote/${q.share_token}?action=accept`} className="text-sage hover:underline">Accept Quote</a>
                    <a href={`/api/quotes/${q.id}/pdf`} target="_blank" className="text-walnut hover:underline">Download PDF</a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {currentOrders.length > 0 && (
          <div className="mb-6">
            <h2 className="font-display text-lg text-walnut mb-2">Current Orders</h2>
            <div className="space-y-2">
              {currentOrders.map(o => (
                <div key={o.id} className="bg-white border border-walnut/10 rounded-xl shadow-sm p-4 flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div className="font-semibold text-walnut">{productLabel(o.product_type as ProductType)} — {o.title}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColor(o.status)}`}>{statusLabel(o.product_type as ProductType, o.status)}</span>
                      {o.due_date && <span className="text-xs text-walnut/50">Pickup: {formatCalendarDate(o.due_date)}</span>}
                    </div>
                  </div>
                  <Link href={`/account/orders/${o.id}`} className="text-xs font-semibold text-walnut hover:underline">View Order</Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {timeline.length > 0 && (
          <div className="mb-6">
            <h2 className="font-display text-lg text-walnut mb-2">Your Timeline</h2>
            <div className="bg-white border border-walnut/10 rounded-xl shadow-sm p-4 space-y-2 max-h-72 overflow-y-auto">
              {timeline.slice(0, 15).map((ev, i) => (
                <div key={i} className="flex justify-between text-sm border-b border-walnut/5 pb-1.5 last:border-0">
                  <span className={ev.color}>{ev.label}</span>
                  <span className="text-walnut/40 text-xs whitespace-nowrap ml-2">{new Date(ev.timestamp).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Link href="/account/orders" className="bg-walnut text-cream px-4 py-2 rounded-md text-sm font-semibold">View All Orders</Link>
          <Link href="/account/quotes" className="border border-walnut/20 text-walnut px-4 py-2 rounded-md text-sm font-semibold">View All Quotes</Link>
          <Link href="/account/purchases" className="border border-walnut/20 text-walnut px-4 py-2 rounded-md text-sm font-semibold">Reorder Previous Purchases</Link>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white border border-walnut/10 rounded-xl shadow-sm p-3 text-center">
      <div className="text-xl font-display text-walnut">{value}</div>
      <div className="text-[10px] text-walnut/50 uppercase tracking-wide">{label}</div>
    </div>
  );
}
