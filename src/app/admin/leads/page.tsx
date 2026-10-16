import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isDemoAccountRequest } from "@/lib/demoMode";
import AddLeadForm from "@/components/AddLeadForm";
import LeadCard from "@/components/LeadCard";
import {
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
  LeadStatus,
  countByStatus,
  effectiveLeadStatus,
  isLeadStatus,
  leadMatchesQuery
} from "@/lib/leads";

export const dynamic = "force-dynamic";

export default async function LeadsPage({ searchParams }: { searchParams: { q?: string; status?: string } }) {
  const supabase = createClient();
  const query = searchParams.q?.trim() || "";
  const activeStatus: LeadStatus | "" = isLeadStatus(searchParams.status) ? searchParams.status : "";

  const isDemoAccount = await isDemoAccountRequest();

  const { data: leadsRaw } = await supabase
    .from("leads")
    .select("*")
    .eq("is_demo", isDemoAccount)
    .order("created_at", { ascending: false });
  const leads = leadsRaw || [];

  // How many orders each linked customer has, so a lead whose customer has
  // ordered shows as "Ordered" on its own.
  const customerIds = Array.from(new Set(leads.map((l: any) => l.customer_id).filter(Boolean)));
  const { data: orderRows } = customerIds.length > 0
    ? await supabase.from("orders").select("customer_id").in("customer_id", customerIds)
    : { data: [] as any[] };
  const orderCountByCustomer: Record<string, number> = {};
  (orderRows || []).forEach((o: any) => {
    orderCountByCustomer[o.customer_id] = (orderCountByCustomer[o.customer_id] || 0) + 1;
  });

  const rows = leads.map((l: any) => {
    const orderCount = l.customer_id ? orderCountByCustomer[l.customer_id] || 0 : 0;
    return { lead: l, orderCount, status: effectiveLeadStatus(l.status, orderCount) };
  });

  // The tab counts ignore the search box on purpose, so they always show
  // the whole list; the list below is then narrowed by tab and search.
  const counts = countByStatus(rows.map(r => r.status));

  const visible = rows.filter(r =>
    (!activeStatus || r.status === activeStatus) && leadMatchesQuery(r.lead, query)
  );

  function tabHref(status: LeadStatus | "") {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (status) params.set("status", status);
    const qs = params.toString();
    return `/admin/leads${qs ? `?${qs}` : ""}`;
  }

  function tabClass(active: boolean) {
    return `inline-block px-3.5 py-1.5 rounded-full text-sm font-semibold border whitespace-nowrap ${
      active
        ? "bg-[#1E3A5F] text-white border-[#1E3A5F]"
        : "bg-white text-[#1E3A5F] border-[#1E3A5F]/20 hover:bg-cream"
    }`;
  }

  return (
    <div>
      <h1 className="font-display text-2xl text-[#1E3A5F] mb-1">Leads</h1>
      <p className="text-sm text-[#1E3A5F]/60 mb-6">
        Everyone who messaged you. Mark where each conversation stands, then click Create order when they're ready.
      </p>

      <AddLeadForm />

      <form method="GET" className="mb-4">
        <input
          name="q"
          defaultValue={query}
          placeholder="Search by name, phone, or notes..."
          className="w-full px-3 py-2.5 border border-[#1E3A5F]/15 rounded-md text-sm"
        />
        {activeStatus && <input type="hidden" name="status" value={activeStatus} />}
      </form>

      <div className="flex flex-wrap gap-2 mb-5">
        <Link href={tabHref("")} className={tabClass(!activeStatus)}>All ({rows.length})</Link>
        {LEAD_STATUSES.map(s => (
          <Link key={s} href={tabHref(s)} className={tabClass(activeStatus === s)}>
            {LEAD_STATUS_LABELS[s]} ({counts[s]})
          </Link>
        ))}
      </div>

      <div className="space-y-3">
        {visible.map(({ lead, status, orderCount }) => (
          <LeadCard
            key={lead.id}
            lead={{
              id: lead.id,
              full_name: lead.full_name,
              phone: lead.phone,
              source: lead.source,
              notes: lead.notes,
              customer_id: lead.customer_id
            }}
            status={status}
            orderCount={orderCount}
            firstContactedLabel={new Date(lead.first_contacted_at).toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric" })}
          />
        ))}
        {visible.length === 0 && (
          <div className="bg-white border border-[#1E3A5F]/10 rounded-xl px-4 py-8 text-center text-sm text-[#1E3A5F]/50">
            {rows.length === 0
              ? "No leads yet. Add the first person who messaged you above."
              : "No one matches that search or tab."}
          </div>
        )}
      </div>
    </div>
  );
}
