import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import QuoteEditor from "@/components/QuoteEditor";

export default async function EditQuotePage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const [{ data: quote }, { data: customers }, { data: products }] = await Promise.all([
    supabase.from("quotes").select("*, profiles:customer_id(full_name, email)").eq("id", params.id).maybeSingle(),
    supabase.from("profiles").select("id, full_name, email").eq("role", "customer").order("full_name", { ascending: true }),
    supabase.from("products").select("id, product_type, name, size_details, price_cents").order("name", { ascending: true })
  ]);

  if (!quote) notFound();

  const { data: items } = await supabase
    .from("quote_items")
    .select("title, description, quantity, unit_price_cents, product_id")
    .eq("quote_id", params.id)
    .order("sort_order", { ascending: true });

  // Every revision of this exact quote — same quote_number + quote_year,
  // whatever revision_number each one is. Used to show "Revision 1,
  // Revision 2, ..." and let the admin view/download any of them.
  const { data: revisions } = await supabase
    .from("quotes")
    .select("id, revision_number, status, viewed_at, sent_at, created_at")
    .eq("quote_number", quote.quote_number)
    .eq("quote_year", quote.quote_year)
    .order("revision_number", { ascending: true });

  return (
    <QuoteEditor
      customers={customers || []}
      products={products || []}
      existingQuote={{
        id: quote.id,
        quote_number: quote.quote_number,
        quote_year: quote.quote_year,
        revision_number: quote.revision_number,
        status: quote.status,
        expiration_date: quote.expiration_date,
        discount_cents: quote.discount_cents,
        delivery_cents: quote.delivery_cents,
        notes: quote.notes,
        terms: quote.terms,
        share_token: quote.share_token,
        converted_order_id: quote.converted_order_id,
        customer_id: quote.customer_id,
        profiles: (quote as any).profiles,
        items: items || [],
        revisions: revisions || []
      }}
    />
  );
}
