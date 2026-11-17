import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateManualReview, reviewDateToIso } from "@/lib/manualReviews";

async function requireAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: adminProfile } = await supabase.from("profiles").select("role").eq("id", user?.id).single();
  return adminProfile?.role === "admin";
}

// Add a review by hand (e.g. one from Facebook). Goes live right away,
// because you typed it in yourself.
export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  const v = validateManualReview(await req.json().catch(() => ({})));
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin.from("product_reviews").insert({
    order_item_id: null,
    customer_id: null,
    source: "facebook",
    reviewer_name: v.value.name,
    product_label: v.value.productLabel || null,
    rating: v.value.rating,
    review_text: v.value.text,
    status: "approved",
    created_at: v.value.iso
  }).select().maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, review: data });
}

// Approve / reject a review, and/or edit it. The date can be changed on any
// review; name, stars, text and product only on ones you added by hand.
export async function PATCH(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { id } = body;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const update: Record<string, any> = { updated_at: new Date().toISOString() };
  if (body.status !== undefined) {
    if (!["approved", "rejected"].includes(body.status)) return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    update.status = body.status;
  }
  if (body.date !== undefined) {
    const iso = reviewDateToIso(String(body.date));
    if (!iso) return NextResponse.json({ error: "Enter a valid date (not in the future)." }, { status: 400 });
    update.created_at = iso;
  }

  const admin = createAdminClient();
  if (body.name !== undefined || body.rating !== undefined || body.text !== undefined || body.productLabel !== undefined) {
    const { data: existing } = await admin.from("product_reviews").select("source").eq("id", id).maybeSingle();
    if (existing?.source !== "facebook") return NextResponse.json({ error: "Only reviews you added by hand can be edited." }, { status: 400 });
    const name = String(body.name ?? "").trim().slice(0, 80);
    const text = String(body.text ?? "").trim().slice(0, 2000);
    const rating = Math.round(Number(body.rating));
    if (!name || !text || !(rating >= 1 && rating <= 5)) return NextResponse.json({ error: "Name, stars and review text are required." }, { status: 400 });
    update.reviewer_name = name;
    update.review_text = text;
    update.rating = rating;
    update.product_label = String(body.productLabel ?? "").trim().slice(0, 100) || null;
  }
  if (Object.keys(update).length === 1) return NextResponse.json({ error: "Nothing to change" }, { status: 400 });

  const { data: updated, error } = await admin.from("product_reviews").update(update).eq("id", id).select().maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!updated) return NextResponse.json({ error: "Review not found" }, { status: 404 });
  return NextResponse.json({ ok: true, review: updated });
}

export async function DELETE(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin.from("product_reviews").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
