import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatQuoteNumberWithRevision } from "@/lib/quote";

export default async function PublicQuotePage({ params }: { params: { token: string } }) {
  const admin = createAdminClient();

  const { data: quote } = await admin
    .from("quotes")
    .select("*, profiles:customer_id(full_name)")
    .eq("share_token", params.token)
    .maybeSingle();

  if (!quote) notFound();

  // Mark as viewed the first time the customer actually opens this link
  // — same "viewed" concept the workflow status list already defines,
  // just triggered here instead of by an admin action.
  if (quote.status === "sent") {
    await admin.from("quotes").update({ status: "viewed", viewed_at: new Date().toISOString() }).eq("id", quote.id);
  }

  const { data: items } = await admin
    .from("quote_items")
    .select("*")
    .eq("quote_id", quote.id)
    .order("sort_order", { ascending: true });

  const isExpired = new Date(quote.expiration_date + "T23:59:59Z") < new Date() && !["accepted", "declined"].includes(quote.status);
  const customerName = (quote as any).profiles?.full_name || "Customer";
  const displayNumber = formatQuoteNumberWithRevision(quote.quote_year, quote.quote_number, quote.revision_number);

  return (
    <div>
      <header className="flex items-center justify-between px-6 md:px-10 py-4 border-b border-walnut/10 bg-cream">
        <Link href="/" className="font-display text-lg md:text-xl text-walnut font-semibold">
          Sunrise Wood Creations
        </Link>
      </header>

      <div className="min-h-[70vh] flex items-center justify-center px-4 py-12 bg-cream">
        <div className="w-full max-w-2xl bg-white border border-walnut/10 rounded-xl p-8">
          <div className="flex items-center justify-between mb-1">
            <h1 className="font-display text-2xl text-walnut">Quote {displayNumber}</h1>
            {isExpired ? (
              <span className="text-xs font-bold bg-ember/15 text-ember px-3 py-1 rounded-full">Expired</span>
            ) : (
              <span className="text-xs font-bold bg-sage/15 text-sage px-3 py-1 rounded-full capitalize">{quote.status}</span>
            )}
          </div>
          <p className="text-sm text-walnut/60 mb-2">Prepared for {customerName}</p>
          {quote.revision_number > 1 && (
            <p className="text-sm font-semibold text-ember mb-4">
              This is Revision {quote.revision_number} — please disregard any earlier version of this quote.
            </p>
          )}

          <div className="space-y-2 mb-6">
            {(items || []).map((it: any) => (
              <div key={it.id} className="flex justify-between border-b border-walnut/5 pb-2">
                <div>
                  <div className="font-semibold text-walnut">{it.title}</div>
                  {it.description && <div className="text-xs text-walnut/50">{it.description}</div>}
                  <div className="text-xs text-walnut/50">Qty {it.quantity} × ${(it.unit_price_cents / 100).toFixed(2)}</div>
                </div>
                <div className="font-semibold text-walnut">${((it.unit_price_cents * it.quantity) / 100).toFixed(2)}</div>
              </div>
            ))}
          </div>

          <div className="space-y-1 text-sm mb-6">
            <div className="flex justify-between text-walnut/70"><span>Subtotal</span><span>${(quote.subtotal_cents / 100).toFixed(2)}</span></div>
            {quote.discount_cents > 0 && <div className="flex justify-between text-ember"><span>Discount</span><span>-${(quote.discount_cents / 100).toFixed(2)}</span></div>}
            <div className="flex justify-between text-walnut/70"><span>Tax</span><span>${(quote.tax_cents / 100).toFixed(2)}</span></div>
            {quote.delivery_cents > 0 && <div className="flex justify-between text-walnut/70"><span>Delivery</span><span>${(quote.delivery_cents / 100).toFixed(2)}</span></div>}
            <div className="flex justify-between text-lg font-bold text-walnut pt-2 border-t border-walnut/10">
              <span>Total</span><span>${(quote.total_cents / 100).toFixed(2)}</span>
            </div>
          </div>

          <p className="text-xs text-walnut/50 mb-6">
            {isExpired ? "This quote has expired. " : `Valid through ${new Date(quote.expiration_date + "T12:00:00Z").toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}. `}
            Contact us if you have any questions.
          </p>

          <a
            href={`/api/quotes/${quote.id}/pdf`}
            target="_blank"
            className="inline-block bg-walnut text-white px-5 py-2.5 rounded-md text-sm font-semibold"
          >
            Download PDF
          </a>
        </div>
      </div>
    </div>
  );
}
