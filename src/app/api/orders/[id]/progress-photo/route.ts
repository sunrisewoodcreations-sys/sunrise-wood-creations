import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Same storage upload pattern already proven for design proofs — a
// new bucket ("progress-photos"), same upload/getPublicUrl shape, no
// new storage mechanism invented for this.
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

  const admin = createAdminClient();
  const buffer = Buffer.from(await file.arrayBuffer());
  const filename = `progress-${params.id}-${Date.now()}.jpg`;

  const { error: uploadError } = await admin.storage
    .from("progress-photos")
    .upload(filename, buffer, { contentType: file.type || "image/jpeg", upsert: true });

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: publicUrlData } = admin.storage.from("progress-photos").getPublicUrl(filename);

  const { data: photo, error: insertError } = await admin
    .from("order_progress_photos")
    .insert({ order_id: params.id, photo_url: publicUrlData.publicUrl })
    .select()
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 400 });

  return NextResponse.json({ ok: true, photo });
}
