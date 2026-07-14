import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { productLabel, statusLabel, statusColor, ProductType } from "@/lib/statusSteps";
import AddOrderWithCustomerPicker from "@/components/AddOrderWithCustomerPicker";
import DeleteOrderButton from "@/components/DeleteOrderButton";
import SendInvoiceButton from "@/components/SendInvoiceButton";
import SendStatusEmailButton from "@/components/SendStatusEmailButton";

const SALES_TAX_RATE = 0.06; // Michigan

function easternParts(dateInput: string | Date) {
  const d = new Date(dateInput);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "numeric"
  }).formatToParts(d);
  const year = Number(parts.find(p => p.type === "year")?.value);
  const month = Number(parts.find(p => p.type === "month")?.value); // 1-12
  return { year, month };
}

// Same Eastern-date-string helper pattern already used on the Dashboard
// and Reports pages — kept local here, no other file touched for this.
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

type SortKey = "due_date" | "created_at" | "customer" | "status" | "balance";

function SummaryCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="bg-white border border-[#1E3A5F]/10 rounded-xl p-4">
      <div className="text-xs text-[#1E3A5F]/50 uppercase tracking-wide mb-1">{label}</div>
      <div className={`text-xl font-display ${color || "text-[#1E3A5F]"}`}>{value}</div>
    </div>
  );
}

function SortLink({
  label, sortKey, currentSort, currentDir, query
}: { label: string; sortKey: SortKey; currentSort: string; currentDir: string; query: string }) {
  const isActive = currentSort === sortKey;
  const nextDir = isActive && currentDir === "asc" ? "desc" : "asc";
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  params.set("sort", sortKey);
  params.set("dir", nextDir);

  return (
    <Link href={`/admin/orders?${params.toString()}`} className="inline-flex items-center gap-1 hover:text-white">
      {label}
      {isActive && <span>{currentDir === "asc" ? "▲" : "▼"}</span>}
    </Link>
  );
}

export default async function AdminOrdersPage({
  searchParams
}: {
  searchParams: { q?: string; sort?: string; dir?: string };
}) {
  const supabase = createClient();
  const query = searchParams.q?.trim() || "";
  const sortKey = (searchParams.sort as SortKey) || "created_at";
  const sortDir = searchParams.dir === "asc" ? "asc" : "desc";

  let ordersQuery = supabase
    .from("orders")
    .select("*, profiles:customer_id!inner(full_name, email)")
    .order("created_at", { ascending: false });

  if (query) {
    ordersQuery = ordersQuery.or(
      `full_name.ilike.%${query}%,email.ilike.%${query}%`,
      { foreignTable: "profiles" }
    );
  }

  const { data: ordersRaw } = await ordersQuery;
  const orders = ordersRaw || [];

  const { data: allCustomers } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("role", "customer")
    .order("full_name");

  const { data: savedProducts } = await supabase
    .from("products")
    .select("id, product_type, name, size_details, price_cents")
    .order("name");

  const orderIds = orders.map((o: any) => o.id);

  const { data: invoices } = orderIds.length > 0
    ? await supabase
        .from("invoices")
        .select("*")
        .in("order_id", orderIds)
        .order("created_at", { ascending: false })
    : { data: [] as any[] };

  const latestInvoiceByOrder: Record<string, any> = {};
  (invoices || []).forEach((inv: any) => {
    if (!latestInvoiceByOrder[inv.order_id]) {
      latestInvoiceByOrder[inv.order_id] = inv;
    }
  });

  // Sales/tax totals only count orders that have actually been picked up,
  // bucketed by the date they were picked up — not the date they were placed.
  const { data: pickupEvents } = orderIds.length > 0
    ? await supabase
        .from("order_status_history")
        .select("order_id, created_at")
        .eq("status", "picked_up")
        .in("order_id", orderIds)
        .order("created_at", { ascending: true })
    : { data: [] as any[] };

  const pickedUpAtByOrder: Record<string, string> = {};
  (pickupEvents || []).forEach((ev: any) => {
    if (!pickedUpAtByOrder[ev.order_id]) {
      pickedUpAtByOrder[ev.order_id] = ev.created_at;
    }
  });

  const { year: currentYear, month: currentMonth } = easternParts(new Date());
  const currentQuarter = Math.floor((currentMonth - 1) / 3); // 0-3
  const quarterLabel = `Q${currentQuarter + 1} ${currentYear}`;

  let quarterSalesCents = 0;
  let yearSalesCents = 0;

  orders.forEach((order: any) => {
    const pickedUpAt = pickedUpAtByOrder[order.id];
    if (!pickedUpAt) return; // not picked up yet — doesn't count toward sales/tax

    const { year, month } = easternParts(pickedUpAt);
    const quarter = Math.floor((month - 1) / 3);

    if (year === currentYear) {
      yearSalesCents += order.price_cents || 0;
      if (quarter === currentQuarter) {
        quarterSalesCents += order.price_cents || 0;
      }
    }
  });

  const quarterGross = quarterSalesCents / 100;
  const yearGross = yearSalesCents / 100;

  // Prices already include the 6% tax rather than adding it on top,
  // so back it out: gross ÷ 1.06 = the actual sale amount, and the
  // difference between gross and that is what's owed to the state.
  const quarterSales = quarterGross / (1 + SALES_TAX_RATE);
  const yearSales = yearGross / (1 + SALES_TAX_RATE);
  const quarterTaxOwed = quarterGross - quarterSales;

  // --- New: pending-proof lookup, for "Waiting on customer" (same
  // definition already used on the Dashboard, kept consistent). ---
  const { data: pendingProofs } = orderIds.length > 0
    ? await supabase.from("proofs").select("order_id").eq("status", "pending").in("order_id", orderIds)
    : { data: [] as any[] };
  const waitingOnCustomerOrderIds = new Set((pendingProofs || []).map((p: any) => p.order_id));

  const { year: ty, month: tm, day: td } = easternDateParts(new Date());
  const todayStr = `${ty}-${String(tm).padStart(2, "0")}-${String(td).padStart(2, "0")}`;
  const weekFromNow = new Date();
  weekFromNow.setDate(weekFromNow.getDate() + 7);
  const { year: wy, month: wm, day: wd } = easternDateParts(weekFromNow);
  const weekFromNowStr = `${wy}-${String(wm).padStart(2, "0")}-${String(wd).padStart(2, "0")}`;

  // --- New summary row calculations ---
  const totalActive = orders.filter((o: any) => o.status !== "picked_up").length;
  const dueToday = orders.filter((o: any) => o.status !== "picked_up" && o.due_date === todayStr).length;
  const dueThisWeek = orders.filter((o: any) => o.status !== "picked_up" && o.due_date && o.due_date >= todayStr && o.due_date <= weekFromNowStr).length;
  const waitingOnCustomer = orders.filter((o: any) => waitingOnCustomerOrderIds.has(o.id)).length;
  const waitingOnPayment = orders.filter((o: any) => o.status !== "picked_up" && (o.amount_paid_cents || 0) < (o.price_cents || 0)).length;
  const readyForPickup = orders.filter((o: any) => o.status === "ready_for_pickup").length;

  // --- New: sort the fetched orders in memory (same list, just reordered
  // for display — search and all existing querying above is untouched). ---
  const sorted = [...orders].sort((a: any, b: any) => {
    let cmp = 0;
    if (sortKey === "due_date") {
      cmp = (a.due_date || "9999-99-99").localeCompare(b.due_date || "9999-99-99");
    } else if (sortKey === "created_at") {
      cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    } else if (sortKey === "customer") {
      cmp = (a.profiles?.full_name || "").localeCompare(b.profiles?.full_name || "");
    } else if (sortKey === "status") {
      cmp = (a.status || "").localeCompare(b.status || "");
    } else if (sortKey === "balance") {
      const balA = (a.price_cents || 0) - (a.amount_paid_cents || 0);
      const balB = (b.price_cents || 0) - (b.amount_paid_cents || 0);
      cmp = balA - balB;
    }
    return sortDir === "asc" ? cmp : -cmp;
  });

  return (
    <div>
      <h1 className="font-display text-2xl text-[#1E3A5F] mb-1">Orders</h1>
      <p className="text-sm text-[#1E3A5F]/60 mb-6">All orders, across every customer.</p>

      {/* New summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <SummaryCard label="Total active" value={totalActive} />
        <SummaryCard label="Due today" value={dueToday} color={dueToday > 0 ? "text-ember" : undefined} />
        <SummaryCard label="Due this week" value={dueThisWeek} />
        <SummaryCard label="Waiting on customer" value={waitingOnCustomer} color={waitingOnCustomer > 0 ? "text-ember" : undefined} />
        <SummaryCard label="Waiting on payment" value={waitingOnPayment} color={waitingOnPayment > 0 ? "text-ember" : undefined} />
        <SummaryCard label="Ready for pickup" value={readyForPickup} color="text-sage" />
      </div>

      <div className="bg-white border border-[#1E3A5F]/10 rounded-xl p-5 mb-6">
        <div className="text-xs text-[#1E3A5F]/50 uppercase tracking-wide mb-3">Download invoices in bulk (paid orders only)</div>
        <div className="flex flex-wrap gap-2">
          <a href="/api/invoices/bulk?period=this_month" className="border border-[#1E3A5F]/20 text-[#1E3A5F] px-3 py-1.5 rounded-md text-xs font-semibold hover:bg-cream">This month</a>
          <a href="/api/invoices/bulk?period=this_quarter" className="border border-[#1E3A5F]/20 text-[#1E3A5F] px-3 py-1.5 rounded-md text-xs font-semibold hover:bg-cream">This quarter</a>
          <a href="/api/invoices/bulk?period=last_quarter" className="border border-[#1E3A5F]/20 text-[#1E3A5F] px-3 py-1.5 rounded-md text-xs font-semibold hover:bg-cream">Last quarter</a>
          <a href="/api/invoices/bulk?period=this_year" className="border border-[#1E3A5F]/20 text-[#1E3A5F] px-3 py-1.5 rounded-md text-xs font-semibold hover:bg-cream">This year</a>
          <a href="/api/invoices/bulk?period=last_year" className="border border-[#1E3A5F]/20 text-[#1E3A5F] px-3 py-1.5 rounded-md text-xs font-semibold hover:bg-cream">Last year</a>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-[#1E3A5F]/10 rounded-xl p-5">
          <div className="text-xs text-[#1E3A5F]/50 uppercase tracking-wide mb-1">
            {quarterLabel} sales (after tax removed)
          </div>
          <div className="text-2xl font-display text-[#1E3A5F]">${quarterSales.toFixed(2)}</div>
        </div>
        <div className="bg-ember/5 border border-ember/20 rounded-xl p-5">
          <div className="text-xs text-[#1E3A5F]/50 uppercase tracking-wide mb-1">
            Sales tax owed ({quarterLabel}, 6% MI)
          </div>
          <div className="text-2xl font-display text-ember">${quarterTaxOwed.toFixed(2)}</div>
        </div>
        <div className="bg-white border border-[#1E3A5F]/10 rounded-xl p-5">
          <div className="text-xs text-[#1E3A5F]/50 uppercase tracking-wide mb-1">
            Sales year-to-date ({currentYear}, after tax removed)
          </div>
          <div className="text-2xl font-display text-[#1E3A5F]">${yearSales.toFixed(2)}</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <AddOrderWithCustomerPicker customers={allCustomers || []} products={savedProducts || []} />

        <form method="GET" className="flex-1 min-w-[240px]">
          <input
            name="q"
            defaultValue={query}
            placeholder="Search orders by customer name or email..."
            className="w-full px-3 py-2.5 border border-[#1E3A5F]/15 rounded-md text-sm"
          />
          {sortKey !== "created_at" && <input type="hidden" name="sort" value={sortKey} />}
          {sortDir !== "desc" && <input type="hidden" name="dir" value={sortDir} />}
        </form>
        <a
          href="/api/export/orders"
          className="border border-[#1E3A5F]/20 text-[#1E3A5F] px-3 py-2 rounded-md text-xs font-semibold hover:bg-cream whitespace-nowrap"
        >
          Export CSV
        </a>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full bg-white border border-[#1E3A5F]/10 rounded-xl overflow-hidden text-sm">
          <thead>
            <tr className="bg-[#1E3A5F] text-white text-xs uppercase tracking-wide">
              <th className="text-left px-4 py-3">Product</th>
              <th className="text-left px-4 py-3"><SortLink label="Customer" sortKey="customer" currentSort={sortKey} currentDir={sortDir} query={query} /></th>
              <th className="text-left px-4 py-3"><SortLink label="Order date" sortKey="created_at" currentSort={sortKey} currentDir={sortDir} query={query} /></th>
              <th className="text-left px-4 py-3"><SortLink label="Status" sortKey="status" currentSort={sortKey} currentDir={sortDir} query={query} /></th>
              <th className="text-left px-4 py-3"><SortLink label="Due date" sortKey="due_date" currentSort={sortKey} currentDir={sortDir} query={query} /></th>
              <th className="text-right px-4 py-3">Sales</th>
              <th className="text-right px-4 py-3">Paid</th>
              <th className="text-right px-4 py-3"><SortLink label="Balance due" sortKey="balance" currentSort={sortKey} currentDir={sortDir} query={query} /></th>
              <th className="text-left px-4 py-3">Invoice</th>
              <th className="text-right px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((order: any) => {
              const invoice = latestInvoiceByOrder[order.id];
              const balanceCents = (order.price_cents || 0) - (order.amount_paid_cents || 0);
              const isOverdue = order.status !== "picked_up" && order.due_date && order.due_date < todayStr;
              const isDueToday = order.status !== "picked_up" && order.due_date === todayStr;
              const rowBg = isOverdue ? "bg-ember/5" : isDueToday ? "bg-amber/10" : "";

              return (
                <tr key={order.id} className={`border-t border-[#1E3A5F]/10 hover:bg-cream/60 ${rowBg}`}>
                  <td className="px-4 py-3">
                    <Link href={`/admin/orders/${order.id}`} className="font-semibold text-[#1E3A5F]">
                      {productLabel(order.product_type as ProductType)} — {order.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-[#1E3A5F]/70">{order.profiles?.full_name}</td>
                  <td className="px-4 py-3 font-mono text-[#1E3A5F]/70">
                    {new Date(order.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${statusColor(order.status)}`}>
                      {statusLabel(order.product_type as ProductType, order.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono">
                    {order.due_date ? (
                      <span className={isOverdue ? "text-ember font-semibold" : isDueToday ? "text-ember font-semibold" : "text-[#1E3A5F]/70"}>
                        {new Date(order.due_date + "T00:00:00").toLocaleDateString()}
                        {isOverdue ? " (overdue)" : isDueToday ? " (today)" : ""}
                      </span>
                    ) : (
                      <span className="text-[#1E3A5F]/30">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-[#1E3A5F]/70">
                    ${((order.price_cents || 0) / 100).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right text-[#1E3A5F]/70">
                    ${((order.amount_paid_cents || 0) / 100).toFixed(2)}
                  </td>
                  <td className={`px-4 py-3 text-right font-semibold ${balanceCents > 0 ? "text-ember" : "text-sage"}`}>
                    ${(balanceCents / 100).toFixed(2)}
                  </td>
                  <td className="px-4 py-3">
                    {invoice?.pdf_url ? (
                      <a
                        href={invoice.pdf_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-semibold text-ember hover:underline"
                      >
                        Download #{invoice.invoice_number}
                      </a>
                    ) : (
                      <span className="text-xs text-[#1E3A5F]/40">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col items-end gap-1.5">
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="border border-[#1E3A5F] text-[#1E3A5F] px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap"
                      >
                        Open order
                      </Link>
                      <SendInvoiceButton orderId={order.id} />
                      <SendStatusEmailButton orderId={order.id} />
                      <DeleteOrderButton orderId={order.id} orderTitle={order.title} />
                    </div>
                  </td>
                </tr>
              );
            })}
            {sorted.length === 0 && (
              <tr><td colSpan={10} className="px-4 py-6 text-center text-[#1E3A5F]/50">No orders yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
