import { createClient } from "@/lib/supabase/server";
import { isDemoAccountRequest } from "@/lib/demoMode";
import { formatQuoteNumberWithRevision } from "@/lib/quote";
import QuotesPageTabs from "@/components/QuotesPageTabs";

export default async function QuotesPage({ searchParams }: { searchParams: { tab?: string; q?: string } }) {
  const supabase = createClient();
  const isDemoAccount = await isDemoAccountRequest();

  const [{ data: quoteRequests }, { data: allQuotes }] = await Promise.all([
    supabase.from("quote_requests").select("*").order("created_at", { ascending: false }),
    supabase.from("quotes").select("*, profiles:customer_id(full_name, email, phone)").eq("is_demo", isDemoAccount).order("created_at", { ascending: false })
  ]);

  // The list shows only the latest revision of each quote (same
  // quote_number + quote_year) — older revisions are still fully
  // accessible from that quote's own Revision History, just not
  // cluttering the main list as separate-looking entries.
  const latestByLineage = new Map<string, any>();
  (allQuotes || []).forEach((q: any) => {
    const key = `${q.quote_year}-${q.quote_number}`;
    const existing = latestByLineage.get(key);
    if (!existing || q.revision_number > existing.revision_number) {
      latestByLineage.set(key, q);
    }
  });
  let quotes = Array.from(latestByLineage.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  // Search by customer name, email, phone, or quote number — matching
  // the same instant, query-param-driven pattern already used on
  // Orders and Customers, just also covering the quote number, which
  // neither of those needed before.
  const query = searchParams.q?.trim().toLowerCase() || "";
  if (query) {
    quotes = quotes.filter((q: any) =>
      q.profiles?.full_name?.toLowerCase().includes(query) ||
      q.profiles?.email?.toLowerCase().includes(query) ||
      q.profiles?.phone?.toLowerCase().includes(query) ||
      formatQuoteNumberWithRevision(q.quote_year, q.quote_number, q.revision_number).toLowerCase().includes(query)
    );
  }

  return (
    <QuotesPageTabs
      currentTab={searchParams.tab === "quotes" ? "quotes" : "requests"}
      quoteRequests={quoteRequests || []}
      quotes={quotes}
      searchQuery={searchParams.q || ""}
    />
  );
}
