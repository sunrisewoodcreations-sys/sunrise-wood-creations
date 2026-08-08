import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { calculateQuoteTotals } from "@/lib/quote";

function todayEasternStr(): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  return `${parts.find(p => p.type === "year")!.value}-${parts.find(p => p.type === "month")!.value}-${parts.find(p => p.type === "day")!.value}`;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: adminProfile } = await supabase.from("profiles").select("role").eq("id", user?.id).single();
  if (adminProfile?.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const admin = createAdminClient();
  const body = await req.json();
  const { items, discountCents, deliveryCents, expirationDate, notes, terms, status, customerId } = body;

  const { data: currentQuote } = await admin.from("quotes").select("*").eq("id", params.id).maybeSingle();
  if (!currentQuote) return NextResponse.json({ error: "Quote not found" }, { status: 404 });

  // Once a quote has actually been sent, editing its content (items or
  // pricing) creates a brand new revision instead of overwriting it —
  // the previous version stays exactly as the customer saw it. A
  // still-draft quote (never sent) or a status-only change (e.g.
  // manually marking Accepted) never needs a new revision.
  const isContentChange = Array.isArray(items);
  const needsNewRevision = isContentChange && currentQuote.status !== "draft";

  if (needsNewRevision) {
    if (items.some((it: any) => !it.title?.trim())) {
      return NextResponse.json({ error: "Every line item needs a title" }, { status: 400 });
    }
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
    const todayStr = todayEasternStr();

    const { data: newRevision, error: revisionError } = await admin
      .from("quotes")
      .insert({
        quote_number: currentQuote.quote_number, // same quote number, on purpose
        quote_year: currentQuote.quote_year,
        revision_number: currentQuote.revision_number + 1,
        customer_id: customerId || currentQuote.customer_id,
        status: "draft", // a new revision hasn't been sent yet, even if the prior one was
        issue_date: todayStr,
        expiration_date: expirationDate || currentQuote.expiration_date,
        subtotal_cents: totals.subtotalCents,
        discount_cents: discount,
        tax_cents: totals.taxCents,
        delivery_cents: delivery,
        total_cents: totals.totalCents,
        notes: notes !== undefined ? (notes || null) : currentQuote.notes,
        terms: terms !== undefined ? (terms || null) : currentQuote.terms,
        quote_request_id: currentQuote.quote_request_id
        // Deliberately NOT copying sent_at, viewed_at, or converted_order_id —
        // this revision hasn't been sent, viewed, or converted yet itself.
      })
      .select()
      .single();

    if (revisionError || !newRevision) {
      return NextResponse.json({ error: revisionError?.message || "Couldn't create a new revision" }, { status: 400 });
    }

    const itemRows = normalizedItems.map((it: any, i: number) => ({
      quote_id: newRevision.id,
      product_id: it.productId,
      title: it.title,
      description: it.description,
      quantity: it.quantity,
      unit_price_cents: it.unitPriceCents,
      sort_order: i
    }));
    const { error: itemsError } = await admin.from("quote_items").insert(itemRows);
    if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 400 });

    return NextResponse.json({ ok: true, newRevisionId: newRevision.id });
  }

  const updatePayload: Record<string, any> = {};
  if (expirationDate) updatePayload.expiration_date = expirationDate;
  if (notes !== undefined) updatePayload.notes = notes || null;
  if (terms !== undefined) updatePayload.terms = terms || null;
  if (customerId) updatePayload.customer_id = customerId;
  if (status && ["draft", "sent", "viewed", "accepted", "declined"].includes(status)) updatePayload.status = status;

  // If line items or pricing changed, recompute totals the exact same
  // way quote creation does — never a second, different formula.
  if (isContentChange) {
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

    updatePayload.subtotal_cents = totals.subtotalCents;
    updatePayload.discount_cents = discount;
    updatePayload.tax_cents = totals.taxCents;
    updatePayload.delivery_cents = delivery;
    updatePayload.total_cents = totals.totalCents;

    await admin.from("quote_items").delete().eq("quote_id", params.id);
    const itemRows = normalizedItems.map((it: any, i: number) => ({
      quote_id: params.id,
      product_id: it.productId,
      title: it.title,
      description: it.description,
      quantity: it.quantity,
      unit_price_cents: it.unitPriceCents,
      sort_order: i
    }));
    const { error: itemsError } = await admin.from("quote_items").insert(itemRows);
    if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 400 });
  }

  const { error } = await admin.from("quotes").update(updatePayload).eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: adminProfile } = await supabase.from("profiles").select("role").eq("id", user?.id).single();
  if (adminProfile?.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("quotes").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
