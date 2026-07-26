import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { formatQuoteNumberWithRevision } from "@/lib/quote";
import AccountQuoteRow from "@/components/AccountQuoteRow";

export default async function AccountQuotesPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS-respecting client, scoped to this customer's own quotes only —
  // same auth pattern the rest of the account area already uses.
  const { data: allQuotes } = await supabase
    .from("quotes")
    .select("*")
    .eq("customer_id", user.id)
    .order("created_at", { ascending: false });

  // Same "only show the latest revision of each quote" rule already
  // used on the admin Quotes list, so a customer doesn't see old,
  // superseded versions cluttering their list either.
  const latestByLineage = new Map<string, any>();
  (allQuotes || []).forEach((q: any) => {
    const key = `${q.quote_year}-${q.quote_number}`;
    const existing = latestByLineage.get(key);
    if (!existing || q.revision_number > existing.revision_number) latestByLineage.set(key, q);
  });
  const quotes = Array.from(latestByLineage.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  // Every revision of every quote, grouped by lineage, so each row can
  // offer a "view revisions" list without a second round-trip per quote.
  const revisionsByLineage: Record<string, any[]> = {};
  (allQuotes || []).forEach((q: any) => {
    const key = `${q.quote_year}-${q.quote_number}`;
    if (!revisionsByLineage[key]) revisionsByLineage[key] = [];
    revisionsByLineage[key].push(q);
  });

  return (
    <div className="min-h-screen flex flex-col bg-cream">
      <SiteHeader />
      <main className="flex-1 max-w-4xl mx-auto px-4 py-10 w-full">
        <Link href="/account" className="text-sm text-walnut/60 mb-4 inline-block">← Back to your orders</Link>
        <h1 className="font-display text-2xl text-walnut mb-1">Your Quotes</h1>
        <p className="text-sm text-walnut/60 mb-6">Every quote we've sent you, and any you've accepted or declined.</p>

        {quotes.length === 0 ? (
          <div className="bg-white border border-walnut/10 rounded-xl p-8 text-center text-sm text-walnut/50">
            You don't have any quotes yet.
          </div>
        ) : (
          <div className="space-y-3">
            {quotes.map((q: any) => (
              <AccountQuoteRow
                key={q.id}
                quote={{
                  id: q.id,
                  displayNumber: formatQuoteNumberWithRevision(q.quote_year, q.quote_number, q.revision_number),
                  status: q.status,
                  createdAt: q.created_at,
                  expirationDate: q.expiration_date,
                  totalCents: q.total_cents,
                  revisionNumber: q.revision_number,
                  shareToken: q.share_token,
                  convertedOrderId: q.converted_order_id
                }}
                revisions={(revisionsByLineage[`${q.quote_year}-${q.quote_number}`] || [])
                  .sort((a, b) => b.revision_number - a.revision_number)
                  .map((r: any) => ({
                    id: r.id,
                    revisionNumber: r.revision_number,
                    status: r.status,
                    displayNumber: formatQuoteNumberWithRevision(r.quote_year, r.quote_number, r.revision_number),
                    shareToken: r.share_token
                  }))}
              />
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
