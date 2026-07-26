import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { calculateQuoteTotals, getNextQuoteNumber } from "@/lib/quote";

function todayEasternStr(): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  return `${parts.find(p => p.type === "year")!.value}-${parts.find(p => p.type === "month")!.value}-${parts.find(p => p.type === "day")!.value}`;
}
function addDaysToDateStr(ds: string, days: number): string {
  const [y, m, d] = ds.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: adminProfile } = await supabase.from("profiles").select("role").eq("id", user?.id).single();
  if (adminProfile?.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { customerId, items, discountCents, deliveryCents, expirationDate, notes, terms, quoteRequestId } = await req.json();

  if (!customerId) return NextResponse.json({ error: "Select a customer" }, { status: 400 });
  if (!Array.isArray(items) || items.length === 0) return NextResponse.json({ error: "Add at least one line item" }, { status: 400 });
  if (items.some((it: any) => !it.title?.trim())) return NextResponse.json({ error: "Every line item needs a title" }, { status: 400 });

  const normalizedItems = items.map((it: any) => ({
    productId: it.productId || null,
    title: it.title.trim(),
    description: it.description || null,
    quantity: Math.max(1, Math.round(Number(it.quantity)) || 1),
    unitPriceCents: Math.round(Number(it.unitPriceCents)) || 0
  }));

  const discount = Math.max(0, Math.round(Number(discountCents)) || 0);
  const delivery = Math.max(0, Math.round(Number(deliveryCents)) || 0);
  const totals = calculateQuoteTotals(normalizedItems, discount, delivery);

  const admin = createAdminClient();
  const todayStr = todayEasternStr();
  const currentYear = Number(todayStr.slice(0, 4));
  const quoteNumber = await getNextQuoteNumber(currentYear);

  const { data: quote, error } = await admin
    .from("quotes")
    .insert({
      quote_number: quoteNumber,
      quote_year: currentYear,
      customer_id: customerId,
      status: "draft",
      issue_date: todayStr,
      expiration_date: expirationDate || addDaysToDateStr(todayStr, 7),
      subtotal_cents: totals.subtotalCents,
      discount_cents: discount,
      tax_cents: totals.taxCents,
      delivery_cents: delivery,
      total_cents: totals.totalCents,
      notes: notes || null,
      terms: terms || null,
      quote_request_id: quoteRequestId || null
    })
    .select()
    .single();

  if (error || !quote) {
    return NextResponse.json({ error: error?.message || "Couldn't create the quote" }, { status: 400 });
  }

  const itemRows = normalizedItems.map((it: any, i: number) => ({
    quote_id: quote.id,
    product_id: it.productId,
    title: it.title,
    description: it.description,
    quantity: it.quantity,
    unit_price_cents: it.unitPriceCents,
    sort_order: i
  }));
  const { error: itemsError } = await admin.from("quote_items").insert(itemRows);
  if (itemsError) {
    return NextResponse.json({ error: itemsError.message }, { status: 400 });
  }

  // If this quote originated from a quote request, mark that request as
  // handled by linking it forward — keeps request -> quote -> order
  // traceable in both directions, per the requirement.
  if (quoteRequestId) {
    await admin.from("quote_requests").update({ converted_quote_id: quote.id }).eq("id", quoteRequestId);
  }

  return NextResponse.json({ ok: true, quote });
}
