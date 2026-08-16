import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEligibleOrderItem } from "@/lib/reviewEligibility";

// Submits a new review, or edits an existing one — same endpoint,
// distinguished by whether a review already exists for this
// order_item. Eligibility is re-checked here on every call, never
// trusted from anything the client sends, since this is exactly the
// endpoint a malicious request would target to fake a review for a
// product never actually purchased.
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const { orderItemId, rating, reviewText } = await req.json();

  if (!orderItemId) return NextResponse.json({ error: "Missing orderItemId" }, { status: 400 });
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Rating must be between 1 and 5" }, { status: 400 });
  }
  if (!reviewText?.trim()) return NextResponse.json({ error: "Review text is required" }, { status: 400 });

  const eligible = await getEligibleOrderItem(orderItemId, user.id);
  if (!eligible) {
    return NextResponse.json({ error: "You can only review products from a completed order you actually purchased." }, { status: 403 });
  }

  const admin = createAdminClient();

  // Editing an existing review re-submits it for approval rather than
  // keeping whatever the previous approval status was — an edited
  // review is different content and shouldn't stay silently published
  // (or silently still-rejected) without being looked at again.
  const { data: existing } = await admin.from("product_reviews").select("id").eq("order_item_id", orderItemId).maybeSingle();

  if (existing) {
    const { data: updated, error } = await admin
      .from("product_reviews")
      .update({ rating, review_text: reviewText.trim(), status: "pending", updated_at: new Date().toISOString() })
      .eq("id", existing.id)
      .select()
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, review: updated });
  }

  const { data: inserted, error } = await admin
    .from("product_reviews")
    .insert({ order_item_id: orderItemId, customer_id: user.id, rating, review_text: reviewText.trim(), status: "pending" })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, review: inserted });
}
