import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { productLabel, statusLabel, statusColor, ProductType } from "@/lib/statusSteps";
import { formatCalendarDate } from "@/lib/dateDisplay";
import { formatInvoiceNumber } from "@/lib/invoice";
import { getWorkflowStage, WORKFLOW_LABELS, WORKFLOW_STYLES, WorkflowStage } from "@/lib/workflow";
import { checkMaterialAvailabilityForOrder } from "@/lib/materialPlanning";
import AddOrderWithCustomerPicker from "@/components/AddOrderWithCustomerPicker";
import DeleteOrderButton from "@/components/DeleteOrderButton";
import SendInvoiceButton from "@/components/SendInvoiceButton";
import SendStatusEmailButton from "@/components/SendStatusEmailButton";
import StatusUpdater from "@/components/StatusUpdater";

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

// Whole-day difference between two Y-M-D date strings, computed at UTC
// noon on both sides to sidestep any DST edge cases.
function daysBetween(fromStr: string, toStr: string): number {
  const from = new Date(`${fromStr}T12:00:00Z`);
  const to = new Date(`${toStr}T12:00:00Z`);
  return Math.round((to.getTime() - from.getTime()) / 86400000);
}

function priorityInfo(todayStr: string, dueDate: string | null, status: string): { label: string; badge: string; daysText: string } | null {
  if (status === "picked_up") return null; // completed orders don't need a priority signal
  if (!dueDate) return { label: "Future", badge: "bg-[#1E3A5F]/10 text-[#1E3A5F]/60", daysText: "No due date" };

  const days = daysBetween(todayStr, dueDate);
  if (days < 0) {
    return { label: "Overdue", badge: "bg-ember text-white", daysText: `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} overdue` };
  }
  if (days === 0) {
    return { label: "Today", badge: "bg-amber text-white", daysText: "Due today" };
  }
  if (days <= 7) {
    return { label: "This Week", badge: "bg-amber/60 text-white", daysText: days === 1 ? "Due tomorrow" : `${days} days left` };
  }
  return { label: "Future", badge: "bg-[#1E3A5F]/10 text-[#1E3A5F]/60", daysText: `${days} days left` };
}

function SummaryCard({
  label, value, color, href, active
}: { label: string; value: string | number; color?: string; href?: string; active?: boolean }) {
  const content = (
    <div
      className={`bg-white border rounded-xl p-5 shadow-sm transition-all ${
        active
          ? "border-[#1E3A5F] ring-2 ring-[#1E3A5F]/25 shadow-md"
          : "border-[#1E3A5F]/10"
      } ${href ? "hover:shadow-lg hover:border-[#1E3A5F]/30 hover:-translate-y-0.5 cursor-pointer" : ""}`}
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className="text-xs text-[#1E3A5F]/50 uppercase tracking-wide">{label}</div>
        {active && (
          <span className="text-[10px] font-semibold text-[#1E3A5F] bg-[#1E3A5F]/10 px-1.5 py-0.5 rounded-full">
            ✓ Active
          </span>
        )}
      </div>
      <div className={`text-2xl font-display ${color || "text-[#1E3A5F]"}`}>{value}</div>
    </div>
  );

  if (!href) return content;
  return <Link href={href} className="block">{content}</Link>;
}

function SortLink({
  label, sortKey, currentSort, currentDir, query, filter
}: { label: string; sortKey: SortKey; currentSort: string; currentDir: string; query: string; filter: string }) {
  const isActive = currentSort === sortKey;
  const nextDir = isActive && currentDir === "asc" ? "desc" : "asc";
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (filter) params.set("filter", filter);
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
  searchParams: { q?: string; sort?: string; dir?: string; filter?: string };
}) {
  const supabase = createClient();
  const query = searchParams.q?.trim() || "";
  const sortKey = (searchParams.sort as SortKey) || "created_at";
  const sortDir = searchParams.dir === "asc" ? "asc" : "desc";
  const activeFilter = searchParams.filter || "";

  let ordersQuery = supabase
    .from("orders")
    .select("*, profiles:customer_id!inner(full_name, email, phone)")
    .order("created_at", { ascending: false });

  const { data: ordersRaw } = await ordersQuery;
  let orders = ordersRaw || [];

  // Filtered in JS rather than a single DB-level query — searching
  // across the joined customer's name/email/phone AND the order's own
  // title/id together isn't a single clean SQL OR condition, and order
  // volume here is small enough that this stays fast and simple.
  if (query) {
    const q = query.toLowerCase();
    orders = orders.filter((o: any) =>
      o.profiles?.full_name?.toLowerCase().includes(q) ||
      o.profiles?.email?.toLowerCase().includes(q) ||
      o.profiles?.phone?.toLowerCase().includes(q) ||
      o.title?.toLowerCase().includes(q) ||
      o.id?.toLowerCase().includes(q)
    );
  }

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

  // Workflow stage per order (src/lib/workflow.ts) — material
  // availability is only checked for orders where it would actually
  // change the answer (scheduled, not yet started, not waiting on the
  // customer), run in parallel rather than one at a time.
  const ordersNeedingMaterialCheck = orders.filter((o: any) =>
    o.production_date && o.production_status === "waiting" && !waitingOnCustomerOrderIds.has(o.id) && o.status !== "picked_up"
  );
  const materialCheckResults = await Promise.all(
    ordersNeedingMaterialCheck.map((o: any) => checkMaterialAvailabilityForOrder(o.id).then(r => [o.id, r.available] as const))
  );
  const materialAvailableByOrderId = new Map(materialCheckResults);

  const workflowStageByOrderId = new Map(
    orders.map((o: any) => [
      o.id,
      getWorkflowStage(o, waitingOnCustomerOrderIds.has(o.id), materialAvailableByOrderId.get(o.id) ?? null)
    ])
  );

  const { year: ty, month: tm, day: td } = easternDateParts(new Date());
  const todayStr = `${ty}-${String(tm).padStart(2, "0")}-${String(td).padStart(2, "0")}`;
  const weekFromNow = new Date();
  weekFromNow.setDate(weekFromNow.getDate() + 7);
  const { year: wy, month: wm, day: wd } = easternDateParts(weekFromNow);
  const weekFromNowStr = `${wy}-${String(wm).padStart(2, "0")}-${String(wd).padStart(2, "0")}`;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const { year: tmy, month: tmm, day: tmd } = easternDateParts(tomorrow);
  const tomorrowStr = `${tmy}-${String(tmm).padStart(2, "0")}-${String(tmd).padStart(2, "0")}`;

  // --- New summary row calculations (always based on the full,
  // unfiltered order list, so the cards' own numbers stay accurate
  // no matter which filter is currently active). ---
  const totalActive = orders.filter((o: any) => o.status !== "picked_up").length;
  const overdueCount = orders.filter((o: any) => o.status !== "picked_up" && o.due_date && o.due_date < todayStr).length;
  const dueToday = orders.filter((o: any) => o.status !== "picked_up" && o.due_date === todayStr).length;
  const dueThisWeek = orders.filter((o: any) => o.status !== "picked_up" && o.due_date && o.due_date >= todayStr && o.due_date <= weekFromNowStr).length;
  const waitingOnCustomer = orders.filter((o: any) => waitingOnCustomerOrderIds.has(o.id)).length;
  const waitingOnPayment = orders.filter((o: any) => o.status !== "picked_up" && (o.amount_paid_cents || 0) < (o.price_cents || 0)).length;
  const readyForPickup = orders.filter((o: any) => o.status === "ready_for_pickup").length;
  const workflowNewCount = orders.filter((o: any) => workflowStageByOrderId.get(o.id) === "new").length;
  const workflowScheduledCount = orders.filter((o: any) => workflowStageByOrderId.get(o.id) === "scheduled").length;
  const workflowReadyToBuildCount = orders.filter((o: any) => workflowStageByOrderId.get(o.id) === "ready_to_build").length;
  const workflowInProductionCount = orders.filter((o: any) => workflowStageByOrderId.get(o.id) === "in_production").length;
  const workflowCompletedCount = orders.filter((o: any) => workflowStageByOrderId.get(o.id) === "completed").length;

  // --- New: which of the fetched (searched) orders match the currently
  // active summary-card filter. Search and everything above stays
  // untouched — this only narrows what's displayed in the table. ---
  const filteredOrders = orders.filter((o: any) => {
    switch (activeFilter) {
      case "active": return o.status !== "picked_up";
      case "new": return o.status === "order_placed";
      case "in_production": return !["order_placed", "ready_for_pickup", "picked_up"].includes(o.status);
      case "overdue": return o.status !== "picked_up" && o.due_date && o.due_date < todayStr;
      case "due_today": return o.status !== "picked_up" && o.due_date === todayStr;
      case "due_week": return o.status !== "picked_up" && o.due_date && o.due_date >= todayStr && o.due_date <= weekFromNowStr;
      case "waiting_customer": return waitingOnCustomerOrderIds.has(o.id);
      case "waiting_payment": return o.status !== "picked_up" && (o.amount_paid_cents || 0) < (o.price_cents || 0);
      case "ready_pickup": return o.status === "ready_for_pickup";
      case "workflow_new": return workflowStageByOrderId.get(o.id) === "new";
      case "workflow_scheduled": return workflowStageByOrderId.get(o.id) === "scheduled";
      case "workflow_ready_to_build": return workflowStageByOrderId.get(o.id) === "ready_to_build";
      case "workflow_in_production": return workflowStageByOrderId.get(o.id) === "in_production";
      case "workflow_completed": return workflowStageByOrderId.get(o.id) === "completed";
      default: return true;
    }
  });

  // --- New: sort the fetched orders in memory (same list, just reordered
  // for display — search and all existing querying above is untouched). ---
  const sorted = [...filteredOrders].sort((a: any, b: any) => {
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

  const filterLabels: Record<string, string> = {
    active: "Total active",
    new: "New orders",
    in_production: "In production",
    overdue: "Overdue",
    due_today: "Due today",
    due_week: "Due this week",
    waiting_customer: "Waiting on customer",
    waiting_payment: "Waiting on payment",
    ready_pickup: "Ready for pickup"
  };

  function filterHref(filterValue: string) {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (sortKey !== "created_at") params.set("sort", sortKey);
    if (sortDir !== "desc") params.set("dir", sortDir);
    // Clicking the already-active card clears the filter instead of re-applying it.
    if (activeFilter !== filterValue) params.set("filter", filterValue);
    const qs = params.toString();
    return `/admin/orders${qs ? `?${qs}` : ""}`;
  }

  return (
    <div>
      <h1 className="font-display text-2xl text-[#1E3A5F] mb-1">Orders</h1>
      <p className="text-sm text-[#1E3A5F]/60 mb-6">All orders, across every customer.</p>

      {/* New summary row — click a card to filter the table below */}
      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-7 gap-4 mb-4">
        <SummaryCard label="Total active" value={totalActive} href={filterHref("active")} active={activeFilter === "active"} />
        <SummaryCard label="Overdue" value={overdueCount} color={overdueCount > 0 ? "text-ember" : "text-sage"} href={filterHref("overdue")} active={activeFilter === "overdue"} />
        <SummaryCard label="Due today" value={dueToday} color={dueToday > 0 ? "text-ember" : undefined} href={filterHref("due_today")} active={activeFilter === "due_today"} />
        <SummaryCard label="Due this week" value={dueThisWeek} href={filterHref("due_week")} active={activeFilter === "due_week"} />
        <SummaryCard label="Waiting on customer" value={waitingOnCustomer} color={waitingOnCustomer > 0 ? "text-ember" : undefined} href={filterHref("waiting_customer")} active={activeFilter === "waiting_customer"} />
        <SummaryCard label="Waiting on payment" value={waitingOnPayment} color={waitingOnPayment > 0 ? "text-ember" : undefined} href={filterHref("waiting_payment")} active={activeFilter === "waiting_payment"} />
        <SummaryCard label="Ready for pickup" value={readyForPickup} color="text-sage" href={filterHref("ready_pickup")} active={activeFilter === "ready_pickup"} />
        <SummaryCard label="Workflow: New" value={workflowNewCount} href={filterHref("workflow_new")} active={activeFilter === "workflow_new"} />
        <SummaryCard label="Workflow: Scheduled" value={workflowScheduledCount} href={filterHref("workflow_scheduled")} active={activeFilter === "workflow_scheduled"} />
        <SummaryCard label="Workflow: Ready to Build" value={workflowReadyToBuildCount} color="text-sage" href={filterHref("workflow_ready_to_build")} active={activeFilter === "workflow_ready_to_build"} />
        <SummaryCard label="Workflow: In Production" value={workflowInProductionCount} color="text-amber" href={filterHref("workflow_in_production")} active={activeFilter === "workflow_in_production"} />
        {/* Waiting on Customer and Ready for Pickup are deliberately not
            duplicated here — the existing "waiting_customer" and
            "ready_pickup" cards just below already filter to exactly
            these same two workflow stages. */}
        <SummaryCard label="Workflow: Completed" value={workflowCompletedCount} color="text-sage" href={filterHref("workflow_completed")} active={activeFilter === "workflow_completed"} />
      </div>

      {activeFilter ? (
        <div className="flex items-center justify-between gap-3 mb-6 bg-[#1E3A5F]/5 border border-[#1E3A5F]/15 rounded-lg px-4 py-3">
          <div className="text-sm text-[#1E3A5F]">
            Filtering by <span className="font-semibold">{filterLabels[activeFilter] || activeFilter}</span>
            <span className="text-[#1E3A5F]/60"> — {sorted.length} order{sorted.length === 1 ? "" : "s"} match</span>
          </div>
          <Link
            href={(() => { const p = new URLSearchParams(); if (query) p.set("q", query); if (sortKey !== "created_at") p.set("sort", sortKey); if (sortDir !== "desc") p.set("dir", sortDir); const qs = p.toString(); return `/admin/orders${qs ? `?${qs}` : ""}`; })()}
            className="text-ember font-semibold text-sm hover:underline whitespace-nowrap"
          >
            Clear filter ✕
          </Link>
        </div>
      ) : (
        <div className="mb-3" />
      )}

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

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <AddOrderWithCustomerPicker customers={allCustomers || []} products={savedProducts || []} />

        <form method="GET" className="flex-1 sm:min-w-[240px]">
          <input
            name="q"
            defaultValue={query}
            placeholder="Search orders by customer name or email..."
            className="w-full px-3 py-2.5 border border-[#1E3A5F]/15 rounded-md text-sm"
          />
          {sortKey !== "created_at" && <input type="hidden" name="sort" value={sortKey} />}
          {sortDir !== "desc" && <input type="hidden" name="dir" value={sortDir} />}
          {activeFilter && <input type="hidden" name="filter" value={activeFilter} />}
        </form>
        <a
          href="/api/export/orders"
          className="text-center border border-[#1E3A5F]/20 text-[#1E3A5F] px-3 py-2.5 sm:py-2 rounded-md text-xs font-semibold hover:bg-cream whitespace-nowrap"
        >
          Export CSV
        </a>
      </div>

      <div className="hidden md:block overflow-x-auto">
        <table className="w-full bg-white border border-[#1E3A5F]/10 rounded-xl overflow-hidden text-sm">
          <thead>
            <tr className="bg-[#1E3A5F] text-white text-xs uppercase tracking-wide">
              <th className="text-left px-4 py-3.5">Product</th>
              <th className="text-left px-4 py-3.5"><SortLink label="Customer" sortKey="customer" currentSort={sortKey} currentDir={sortDir} query={query} filter={activeFilter} /></th>
              <th className="text-left px-4 py-3.5"><SortLink label="Order date" sortKey="created_at" currentSort={sortKey} currentDir={sortDir} query={query} filter={activeFilter} /></th>
              <th className="text-left px-4 py-3.5"><SortLink label="Status" sortKey="status" currentSort={sortKey} currentDir={sortDir} query={query} filter={activeFilter} /></th>
              <th className="text-left px-4 py-3.5"><SortLink label="Due date" sortKey="due_date" currentSort={sortKey} currentDir={sortDir} query={query} filter={activeFilter} /></th>
              <th className="text-left px-4 py-3.5">Priority</th>
              <th className="text-right px-4 py-3.5">Sales</th>
              <th className="text-right px-4 py-3.5">Paid</th>
              <th className="text-right px-4 py-3.5"><SortLink label="Balance due" sortKey="balance" currentSort={sortKey} currentDir={sortDir} query={query} filter={activeFilter} /></th>
              <th className="text-left px-4 py-3.5">Invoice</th>
              <th className="text-right px-4 py-3.5">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((order: any) => {
              const invoice = latestInvoiceByOrder[order.id];
              const balanceCents = (order.price_cents || 0) - (order.amount_paid_cents || 0);
              const isOverdue = order.status !== "picked_up" && order.due_date && order.due_date < todayStr;
              const isDueToday = order.status !== "picked_up" && order.due_date === todayStr;
              const isDueTomorrow = order.status !== "picked_up" && order.due_date === tomorrowStr;
              const priority = priorityInfo(todayStr, order.due_date, order.status);
              const rowBg = isOverdue
                ? "bg-ember/10 border-l-4 border-l-ember"
                : isDueToday
                ? "bg-amber/15"
                : isDueTomorrow
                ? "bg-amber/5"
                : "";

              return (
                <tr key={order.id} className={`border-t border-[#1E3A5F]/10 hover:bg-cream/70 transition-colors ${rowBg}`}>
                  <td className="px-4 py-3.5">
                    <Link href={`/admin/orders/${order.id}`} className="font-semibold text-[#1E3A5F]">
                      {productLabel(order.product_type as ProductType)} — {order.title}
                    </Link>
                    <span className={`ml-2 inline-block text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${WORKFLOW_STYLES[workflowStageByOrderId.get(order.id) as WorkflowStage]}`}>
                      {WORKFLOW_LABELS[workflowStageByOrderId.get(order.id) as WorkflowStage]}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-[#1E3A5F]/70">
                    <Link href={`/admin/customers/${order.customer_id}`} className="hover:underline hover:text-[#1E3A5F]">
                      {order.profiles?.full_name}
                    </Link>
                  </td>
                  <td className="px-4 py-3.5 font-mono text-[#1E3A5F]/70">
                    {new Date(order.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3.5">
                    <StatusUpdater orderId={order.id} productType={order.product_type as ProductType} currentStatus={order.status} />
                  </td>
                  <td className="px-4 py-3.5 font-mono">
                    {order.due_date ? (
                      <span className={isOverdue || isDueToday ? "text-ember font-semibold" : isDueTomorrow ? "text-[#1E3A5F] font-semibold" : "text-[#1E3A5F]/70"}>
                        {isOverdue && "⚠ "}
                        {formatCalendarDate(order.due_date)}
                        {isOverdue ? " (overdue)" : isDueToday ? " (today)" : isDueTomorrow ? " (tomorrow)" : ""}
                      </span>
                    ) : (
                      <span className="text-[#1E3A5F]/30">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    {priority ? (
                      <div>
                        <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${priority.badge}`}>
                          {priority.label}
                        </span>
                        <div className="text-[11px] text-[#1E3A5F]/50 mt-1 whitespace-nowrap">{priority.daysText}</div>
                      </div>
                    ) : (
                      <span className="text-[#1E3A5F]/30 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-right text-[#1E3A5F]/70">
                    ${((order.price_cents || 0) / 100).toFixed(2)}
                  </td>
                  <td className="px-4 py-3.5 text-right text-[#1E3A5F]/70">
                    ${((order.amount_paid_cents || 0) / 100).toFixed(2)}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <span className={`text-base font-bold ${balanceCents > 0 ? "text-ember" : "text-sage"}`}>
                      ${(balanceCents / 100).toFixed(2)}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    {invoice?.pdf_url ? (
                      <a
                        href={invoice.pdf_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-semibold text-ember hover:underline"
                      >
                        Download #{formatInvoiceNumber(invoice.invoice_year, invoice.invoice_number)}
                      </a>
                    ) : (
                      <span className="text-xs text-[#1E3A5F]/40">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
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
              <tr><td colSpan={11} className="px-4 py-6 text-center text-[#1E3A5F]/50">No orders yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile card view — entirely separate from the desktop table
          above (which is untouched), same data, same actions, same
          filtering/sorting/search since it all reads from the same
          `sorted` array computed once above. */}
      <div className="md:hidden space-y-3">
        {sorted.map((order: any) => {
          const invoice = latestInvoiceByOrder[order.id];
          const balanceCents = (order.price_cents || 0) - (order.amount_paid_cents || 0);
          const isOverdue = order.status !== "picked_up" && order.due_date && order.due_date < todayStr;
          const isDueToday = order.status !== "picked_up" && order.due_date === todayStr;
          const isDueTomorrow = order.status !== "picked_up" && order.due_date === tomorrowStr;
          const priority = priorityInfo(todayStr, order.due_date, order.status);

          return (
            <div
              key={order.id}
              className={`bg-white border rounded-xl shadow-sm p-4 ${
                isOverdue ? "border-ember/40 border-l-4 border-l-ember bg-ember/5" : "border-[#1E3A5F]/10"
              }`}
            >
              {/* Most important info first: who it's for, what it is, and its status */}
              <Link href={`/admin/customers/${order.customer_id}`} className="text-base font-bold text-[#1E3A5F] active:underline">
                {order.profiles?.full_name}
              </Link>
              <Link href={`/admin/orders/${order.id}`} className="block text-sm text-[#1E3A5F]/70 mb-2 active:underline">
                {productLabel(order.product_type as ProductType)} — {order.title}
              </Link>

              <span className={`inline-block px-3 py-1.5 rounded-full text-sm font-bold whitespace-nowrap ${statusColor(order.status)}`}>
                {statusLabel(order.product_type as ProductType, order.status)}
              </span>
              <span className={`inline-block ml-1.5 px-3 py-1.5 rounded-full text-sm font-bold whitespace-nowrap ${WORKFLOW_STYLES[workflowStageByOrderId.get(order.id) as WorkflowStage]}`}>
                {WORKFLOW_LABELS[workflowStageByOrderId.get(order.id) as WorkflowStage]}
              </span>

              <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-[#1E3A5F]/10">
                <div>
                  <div className="text-[10px] text-[#1E3A5F]/50 uppercase tracking-wide font-semibold">Pickup date</div>
                  {order.due_date ? (
                    <div className={`text-sm font-mono ${isOverdue || isDueToday ? "text-ember font-semibold" : isDueTomorrow ? "text-[#1E3A5F] font-semibold" : "text-[#1E3A5F]/70"}`}>
                      {isOverdue && "⚠ "}
                      {formatCalendarDate(order.due_date)}
                    </div>
                  ) : (
                    <div className="text-sm text-[#1E3A5F]/30">—</div>
                  )}
                  {priority && <div className="text-[11px] text-[#1E3A5F]/50 mt-0.5">{priority.daysText}</div>}
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-[#1E3A5F]/50 uppercase tracking-wide font-semibold">Amount due</div>
                  <div className={`text-lg font-bold ${balanceCents > 0 ? "text-ember" : "text-sage"}`}>
                    ${(balanceCents / 100).toFixed(2)}
                  </div>
                  <div className="text-[11px] text-[#1E3A5F]/50">
                    ${((order.price_cents || 0) / 100).toFixed(2)} total
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-[#1E3A5F]/10">
                <div className="mb-2">
                  <StatusUpdater orderId={order.id} productType={order.product_type as ProductType} currentStatus={order.status} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/admin/orders/${order.id}`}
                    className="flex-1 min-w-[100px] text-center border border-[#1E3A5F] text-[#1E3A5F] px-3 py-2.5 rounded-md text-sm font-semibold"
                  >
                    Open order
                  </Link>
                  {invoice?.pdf_url && (
                    <a
                      href={invoice.pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 min-w-[100px] text-center border border-ember/30 text-ember px-3 py-2.5 rounded-md text-sm font-semibold"
                    >
                      Invoice #{formatInvoiceNumber(invoice.invoice_year, invoice.invoice_number)}
                    </a>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3 mt-2">
                  <SendInvoiceButton orderId={order.id} />
                  <SendStatusEmailButton orderId={order.id} />
                  <DeleteOrderButton orderId={order.id} orderTitle={order.title} />
                </div>
              </div>
            </div>
          );
        })}
        {sorted.length === 0 && (
          <div className="bg-white border border-[#1E3A5F]/10 rounded-xl shadow-sm px-4 py-6 text-center text-sm text-[#1E3A5F]/50">
            No orders yet.
          </div>
        )}
      </div>
    </div>
  );
}
