import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PROOF_BUCKET, ensureProofBucket } from "@/lib/pickupProof";

// Admin only. Adds a pickup/delivery proof photo to an order. Photos are
// never deleted from here (they are evidence).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: adminProfile } = await supabase.from("profiles").select("role").eq("id", user?.id).single();
  if (adminProfile?.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("photo") as File | null;
  if (!file) return NextResponse.json({ error: "No photo provided" }, { status: 400 });
  if (!(file.type || "").startsWith("image/")) return NextResponse.json({ error: "That file isn't a photo." }, { status: 400 });
  if (file.size > 4_000_000) return NextResponse.json({ error: "That photo is too large." }, { status: 400 });

  const admin = createAdminClient();
  const { data: order } = await admin.from("orders").select("id").eq("id", params.id).maybeSingle();
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  await ensureProofBucket();
  const buffer = Buffer.from(await file.arrayBuffer());
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error: uploadError } = await admin.storage
    .from(PROOF_BUCKET)
    .upload(`${params.id}/${filename}`, buffer, { contentType: "image/jpeg", upsert: false });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
