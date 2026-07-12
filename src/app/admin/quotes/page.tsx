import { createClient } from "@/lib/supabase/server";
import QuoteRow from "@/components/QuoteRow";

export default async function QuotesPage() {
  const supabase = createClient();

  const { data: quotes } = await supabase
    .from("quote_requests")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 className="font-display text-2xl text-[#1E3A5F] mb-1">Quote requests</h1>
      <p className="text-sm text-[#1E3A5F]/60 mb-6">Submissions from the "Request a custom quote" page on your site.</p>

      <div className="space-y-4">
        {(!quotes || quotes.length === 0) && (
          <p className="text-sm text-[#1E3A5F]/50">No quote requests yet.</p>
        )}
        {quotes?.map((q: any) => (
          <QuoteRow key={q.id} quote={q} />
        ))}
      </div>
    </div>
  );
}
