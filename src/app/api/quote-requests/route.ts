import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendQuoteRequestNotice } from "@/lib/email";
import { getPlanterSizes, formatPrice } from "@/lib/planterSizes";

// Public — no login required.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, email, phone, productType, timeline } = body;
  let { dimensions, woodType, budget, description } = body;
  const planterSize: string = body.planterSize || "";

  // Wood is fixed per product, and planters have no budget field,
  // regardless of what the browser sent.
  if (productType === "cornhole") woodType = "Baltic birch";
  if (productType === "planter") {
    woodType = "Cedar";
    budget = "";
    if (planterSize === "custom") {
      dimensions = "Custom size";
    } else if (planterSize) {
      const match = (await getPlanterSizes()).find(z => z.key === planterSize);
      if (match) dimensions = `${match.label} in. (L × W × H), ${formatPrice(match.priceCents)} tax included`;
      if (match && !description?.trim()) description = `Standard size order: ${match.label} in. cedar planter box.`;
    }
  }
  if (productType === "cornhole") dimensions = "";

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
    timeline: typeof timeline === "string" ? timeline.trim() || null : null,
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
