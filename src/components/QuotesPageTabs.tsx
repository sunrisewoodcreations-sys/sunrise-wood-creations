"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import QuoteRow from "@/components/QuoteRow";
import QuoteListRow from "@/components/QuoteListRow";

export default function QuotesPageTabs({
  currentTab,
  quoteRequests,
  quotes
}: {
  currentTab: "requests" | "quotes";
  quoteRequests: any[];
  quotes: any[];
}) {
  const router = useRouter();
  const unhandledRequestCount = quoteRequests.filter(q => !q.converted_quote_id).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="font-display text-2xl text-[#1E3A5F]">Quotes</h1>
        {currentTab === "quotes" && (
          <Link href="/admin/quotes/new">
            <button className="bg-[#1E3A5F] text-white px-4 py-2 rounded-md text-sm font-semibold">+ New Quote</button>
          </Link>
        )}
      </div>
      <p className="text-sm text-[#1E3A5F]/60 mb-6">
        {currentTab === "requests"
          ? "Submissions from the \"Request a custom quote\" page on your site."
          : "Formal, priced quotes you create and send to customers."}
      </p>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => router.push("/admin/quotes?tab=requests")}
          className={`px-4 py-2 rounded-md text-sm font-semibold border ${
            currentTab === "requests" ? "bg-[#1E3A5F] text-white border-[#1E3A5F]" : "bg-white text-[#1E3A5F] border-[#1E3A5F]/20 hover:bg-cream"
          }`}
        >
          Quote Requests {unhandledRequestCount > 0 && `(${unhandledRequestCount})`}
        </button>
        <button
          onClick={() => router.push("/admin/quotes?tab=quotes")}
          className={`px-4 py-2 rounded-md text-sm font-semibold border ${
            currentTab === "quotes" ? "bg-[#1E3A5F] text-white border-[#1E3A5F]" : "bg-white text-[#1E3A5F] border-[#1E3A5F]/20 hover:bg-cream"
          }`}
        >
          Quotes
        </button>
      </div>

      {currentTab === "requests" ? (
        <div className="space-y-4">
          {quoteRequests.length === 0 && <p className="text-sm text-[#1E3A5F]/50">No quote requests yet.</p>}
          {quoteRequests.map((q: any) => <QuoteRow key={q.id} quote={q} />)}
        </div>
      ) : (
        <div className="space-y-3">
          {quotes.length === 0 && <p className="text-sm text-[#1E3A5F]/50">No quotes yet — click "+ New Quote" to create one.</p>}
          {quotes.map((q: any) => <QuoteListRow key={q.id} quote={q} />)}
        </div>
      )}
    </div>
  );
}
