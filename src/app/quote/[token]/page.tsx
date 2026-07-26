import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatQuoteNumberWithRevision } from "@/lib/quote";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import PublicQuoteView from "@/components/PublicQuoteView";

export default async function PublicQuotePage({
  params,
  searchParams
}: {
  params: { token: string };
  searchParams: { action?: string };
}) {
  const admin = createAdminClient();

  const { data: quote } = await admin
    .from("quotes")
    .select("*, profiles:customer_id(full_name)")
    .eq("share_token", params.token)
    .maybeSingle();

  if (!quote) notFound();

  // Mark as viewed the first time the customer actually opens this
  // link — same "viewed" concept the workflow status list already
  // defines, just triggered here instead of by an admin action.
  if (quote.status === "sent") {
    await admin.from("quotes").update({ status: "viewed", viewed_at: new Date().toISOString() }).eq("id", quote.id);
    quote.status = "viewed";
  }

  const { data: items } = await admin
    .from("quote_items")
    .select("*")
    .eq("quote_id", quote.id)
    .order("sort_order", { ascending: true });

  const isExpired = new Date(quote.expiration_date + "T23:59:59Z") < new Date() && !["accepted", "declined"].includes(quote.status);
  const displayNumber = formatQuoteNumberWithRevision(quote.quote_year, quote.quote_number, quote.revision_number);

  return (
    <div className="min-h-screen flex flex-col bg-cream">
      <SiteHeader />
      <main className="flex-1">
        <PublicQuoteView
          token={params.token}
          quoteId={quote.id}
          displayNumber={displayNumber}
          customerName={(quote as any).profiles?.full_name || "Customer"}
          status={quote.status}
          isExpired={isExpired}
          expirationDate={quote.expiration_date}
          revisionNumber={quote.revision_number}
          convertedOrderId={quote.converted_order_id}
          items={(items || []).map((it: any) => ({
            title: it.title,
            description: it.description,
            quantity: it.quantity,
            unitPriceCents: it.unit_price_cents
          }))}
          subtotalCents={quote.subtotal_cents}
          discountCents={quote.discount_cents}
          taxCents={quote.tax_cents}
          deliveryCents={quote.delivery_cents}
          totalCents={quote.total_cents}
          initialAction={searchParams.action === "accept" || searchParams.action === "decline" ? searchParams.action : null}
        />
      </main>
      <SiteFooter />
    </div>
  );
}
