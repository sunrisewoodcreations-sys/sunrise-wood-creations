import { createClient } from "@/lib/supabase/server";

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
          <div key={q.id} className="bg-white border border-[#1E3A5F]/10 rounded-xl p-5">
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold text-[#1E3A5F]">{q.name} <span className="font-normal text-[#1E3A5F]/50">({q.email})</span></div>
              <div className="text-xs font-mono text-[#1E3A5F]/40">
                {new Date(q.created_at).toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric" })}
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-[#1E3A5F]/60 mb-3">
              {q.phone && <div><strong>Phone:</strong> {q.phone}</div>}
              {q.product_type && <div><strong>Type:</strong> {q.product_type}</div>}
              {q.dimensions && <div><strong>Size:</strong> {q.dimensions}</div>}
              {q.wood_type && <div><strong>Wood:</strong> {q.wood_type}</div>}
              {q.budget && <div><strong>Budget:</strong> {q.budget}</div>}
              {q.timeline && <div><strong>Timeline:</strong> {q.timeline}</div>}
            </div>
            <p className="text-sm text-[#1E3A5F]/80 mb-3">{q.description}</p>
            <a
              href={`mailto:${q.email}?subject=${encodeURIComponent("Re: your custom quote request")}`}
              className="text-xs font-semibold text-ember hover:underline"
            >
              Reply by email
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
