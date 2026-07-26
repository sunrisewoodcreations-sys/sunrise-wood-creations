import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildQuotePdf, formatQuoteNumberWithRevision } from "@/lib/quote";

// Public on purpose (no admin check) — this is what the shareable link
// page and the admin "Download PDF" button both call, matching how the
// share link itself works with no login required.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = createAdminClient();

  const { data: quote } = await admin
    .from("quotes")
    .select("*, profiles:customer_id(full_name)")
    .eq("id", params.id)
    .maybeSingle();

  if (!quote) return NextResponse.json({ error: "Quote not found" }, { status: 404 });

  const { data: items } = await admin
    .from("quote_items")
    .select("*")
    .eq("quote_id", params.id)
    .order("sort_order", { ascending: true });

  const pdfBuffer = await buildQuotePdf({
    quoteNumber: quote.quote_number,
    quoteYear: quote.quote_year,
    revisionNumber: quote.revision_number,
    issueDate: quote.issue_date,
    expirationDate: quote.expiration_date,
    customerName: (quote as any).profiles?.full_name || "Customer",
    lineItems: (items || []).map((it: any) => ({
      title: it.title,
      description: it.description,
      quantity: it.quantity,
      unitPriceCents: it.unit_price_cents
    })),
    subtotalCents: quote.subtotal_cents,
    discountCents: quote.discount_cents,
    taxCents: quote.tax_cents,
    deliveryCents: quote.delivery_cents,
    totalCents: quote.total_cents,
    notes: quote.notes,
    terms: quote.terms
  });

  return new NextResponse(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="quote-${formatQuoteNumberWithRevision(quote.quote_year, quote.quote_number, quote.revision_number)}.pdf"`
    }
  });
}
