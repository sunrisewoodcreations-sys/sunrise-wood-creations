import { createClient } from "@/lib/supabase/server";
import QuotesPageTabs from "@/components/QuotesPageTabs";

export default async function QuotesPage({ searchParams }: { searchParams: { tab?: string } }) {
  const supabase = createClient();

  const [{ data: quoteRequests }, { data: allQuotes }] = await Promise.all([
    supabase.from("quote_requests").select("*").order("created_at", { ascending: false }),
    supabase.from("quotes").select("*, profiles:customer_id(full_name, email)").order("created_at", { ascending: false })
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
  const quotes = Array.from(latestByLineage.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <QuotesPageTabs
      currentTab={searchParams.tab === "quotes" ? "quotes" : "requests"}
      quoteRequests={quoteRequests || []}
      quotes={quotes}
    />
  );
}
