import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildQuotePdf, formatQuoteNumberWithRevision } from "@/lib/quote";
import { sendQuoteEmail } from "@/lib/email";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: adminProfile } = await supabase.from("profiles").select("role").eq("id", user?.id).single();
  if (adminProfile?.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: quote } = await admin
    .from("quotes")
    .select("*, profiles:customer_id(full_name, email)")
    .eq("id", params.id)
    .maybeSingle();

  if (!quote) return NextResponse.json({ error: "Quote not found" }, { status: 404 });

  const customer = (quote as any).profiles;
  if (!customer?.email) return NextResponse.json({ error: "This customer has no email on file" }, { status: 400 });

  const { data: items } = await admin.from("quote_items").select("*").eq("quote_id", params.id).order("sort_order", { ascending: true });

  const pdfBuffer = await buildQuotePdf({
    quoteNumber: quote.quote_number,
    quoteYear: quote.quote_year,
    revisionNumber: quote.revision_number,
    issueDate: quote.issue_date,
    expirationDate: quote.expiration_date,
    customerName: customer.full_name,
    lineItems: (items || []).map((it: any) => ({ title: it.title, description: it.description, quantity: it.quantity, unitPriceCents: it.unit_price_cents })),
    subtotalCents: quote.subtotal_cents,
    discountCents: quote.discount_cents,
    taxCents: quote.tax_cents,
    deliveryCents: quote.delivery_cents,
    totalCents: quote.total_cents,
    notes: quote.notes,
    terms: quote.terms
  });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || `https://${req.headers.get("host")}`;
  const shareUrl = `${siteUrl}/quote/${quote.share_token}`;
  const acceptUrl = `${siteUrl}/quote/${quote.share_token}?action=accept`;
  const declineUrl = `${siteUrl}/quote/${quote.share_token}?action=decline`;

  try {
    await sendQuoteEmail({
      toEmail: customer.email,
      customerName: customer.full_name,
      quoteNumberDisplay: formatQuoteNumberWithRevision(quote.quote_year, quote.quote_number, quote.revision_number),
      isRevision: quote.revision_number > 1,
      totalCents: quote.total_cents,
      expirationDateDisplay: new Date(quote.expiration_date + "T12:00:00Z").toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
      shareUrl,
      acceptUrl,
      declineUrl,
      pdfBuffer
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Couldn't send the email" }, { status: 500 });
  }

  const updatePayload: Record<string, any> = { sent_at: new Date().toISOString() };
  if (quote.status === "draft") updatePayload.status = "sent";
  await admin.from("quotes").update(updatePayload).eq("id", params.id);

  return NextResponse.json({ ok: true });
}
