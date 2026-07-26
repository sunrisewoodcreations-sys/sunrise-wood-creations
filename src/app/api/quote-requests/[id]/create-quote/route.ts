import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getNextQuoteNumber } from "@/lib/quote";

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

// Creates a starter draft quote from a quote request — one line item
// pre-filled with whatever the customer described, at $0 (the admin
// fills in real pricing on the quote edit page next). The customer
// record is found-or-created by email, reusing the same "match by
// email" approach already used elsewhere in this app for guest/customer
// matching, not a new lookup rule.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: adminProfile } = await supabase.from("profiles").select("role").eq("id", user?.id).single();
  if (adminProfile?.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: request } = await admin.from("quote_requests").select("*").eq("id", params.id).maybeSingle();
  if (!request) return NextResponse.json({ error: "Quote request not found" }, { status: 404 });

  let { data: customer } = await admin.from("profiles").select("id").eq("email", request.email).maybeSingle();

  if (!customer) {
    const { data: newCustomer, error: customerError } = await admin.auth.admin.createUser({
      email: request.email,
      email_confirm: true,
      user_metadata: { full_name: request.name }
    });
    if (customerError || !newCustomer.user) {
      return NextResponse.json({ error: customerError?.message || "Couldn't create a customer record for this request" }, { status: 400 });
    }
    await admin.from("profiles").update({ full_name: request.name, phone: request.phone || null }).eq("id", newCustomer.user.id);
    customer = { id: newCustomer.user.id };
  }

  const todayStr = todayEasternStr();
  const currentYear = Number(todayStr.slice(0, 4));
  const quoteNumber = await getNextQuoteNumber(currentYear);

  const itemTitle = [request.product_type, request.dimensions].filter(Boolean).join(" — ") || "Custom item";
  const itemDescription = [request.wood_type && `Wood: ${request.wood_type}`, request.description].filter(Boolean).join(". ") || null;

  const { data: quote, error } = await admin
    .from("quotes")
    .insert({
      quote_number: quoteNumber,
      quote_year: currentYear,
      customer_id: customer.id,
      status: "draft",
      issue_date: todayStr,
      expiration_date: addDaysToDateStr(todayStr, 30),
      subtotal_cents: 0,
      tax_cents: 0,
      total_cents: 0,
      quote_request_id: params.id
    })
    .select()
    .single();

  if (error || !quote) {
    return NextResponse.json({ error: error?.message || "Couldn't create the quote" }, { status: 400 });
  }

  await admin.from("quote_items").insert({
    quote_id: quote.id,
    title: itemTitle,
    description: itemDescription,
    quantity: 1,
    unit_price_cents: 0,
    sort_order: 0
  });

  await admin.from("quote_requests").update({ converted_quote_id: quote.id }).eq("id", params.id);

  return NextResponse.json({ ok: true, quote });
}
