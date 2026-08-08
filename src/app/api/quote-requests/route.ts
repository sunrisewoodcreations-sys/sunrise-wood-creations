import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendQuoteRequestNotice } from "@/lib/email";

// Public — no login required.
export async function POST(req: NextRequest) {
  const { name, email, phone, productType, dimensions, woodType, budget, timeline, description } = await req.json();

  if (!name?.trim() || !email?.trim() || !description?.trim()) {
    return NextResponse.json({ error: "Name, email, and a description are required." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { error } = await admin.from("quote_requests").insert({
    name: name.trim(),
    email: email.trim(),
    phone: phone?.trim() || null,
    product_type: productType || null,
    dimensions: dimensions?.trim() || null,
    wood_type: woodType?.trim() || null,
    budget: budget?.trim() || null,
    timeline: timeline?.trim() || null,
    description: description.trim()
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  try {
    await sendQuoteRequestNotice({
      name: name.trim(),
      email: email.trim(),
      phone: phone?.trim(),
      productType,
      dimensions,
      woodType,
      budget,
      timeline,
      description: description.trim()
    });
  } catch (err) {
    console.error("Quote request notice failed to send:", err);
  }

  return NextResponse.json({ ok: true });
}
