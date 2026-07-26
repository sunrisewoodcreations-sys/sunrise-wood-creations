import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getNextQuoteNumber, copyQuoteItemsTo } from "@/lib/quote";

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

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: adminProfile } = await supabase.from("profiles").select("role").eq("id", user?.id).single();
  if (adminProfile?.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: source } = await admin.from("quotes").select("*").eq("id", params.id).maybeSingle();
  if (!source) return NextResponse.json({ error: "Original quote not found" }, { status: 404 });

  const todayStr = todayEasternStr();
  const currentYear = Number(todayStr.slice(0, 4));
  const quoteNumber = await getNextQuoteNumber(currentYear);

  const { data: newQuote, error } = await admin
    .from("quotes")
    .insert({
      quote_number: quoteNumber,
      quote_year: currentYear,
      customer_id: source.customer_id,
      status: "draft",
      issue_date: todayStr,
      expiration_date: addDaysToDateStr(todayStr, 7),
      subtotal_cents: source.subtotal_cents,
      discount_cents: source.discount_cents,
      tax_cents: source.tax_cents,
      delivery_cents: source.delivery_cents,
      total_cents: source.total_cents,
      notes: source.notes,
      terms: source.terms
      // Deliberately NOT copying quote_request_id or converted_order_id —
      // a duplicate is a fresh quote, not a continuation of the original's history.
    })
    .select()
    .single();

  if (error || !newQuote) {
    return NextResponse.json({ error: error?.message || "Couldn't duplicate the quote" }, { status: 400 });
  }

  await copyQuoteItemsTo(admin, params.id, newQuote.id);

  return NextResponse.json({ ok: true, quote: newQuote });
}
