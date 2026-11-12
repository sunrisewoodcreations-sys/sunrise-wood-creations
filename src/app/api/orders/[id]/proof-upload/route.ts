import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Uploads a design image straight from the order page (no trip to the
// Supabase dashboard). The browser shrinks it first; this shrinks it again
// as a safety net so a customer's phone never has to load a huge image.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: p } = await supabase.from("profiles").select("role").eq("id", user?.id).single();
  if (p?.role !== "admin") return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const form = await req.formData();
  const file = form.get("image") as File | null;
  if (!file) return NextResponse.json({ error: "No image provided" }, { status: 400 });

  let out: Buffer;
  try {
    out = await sharp(Buffer.from(await file.arrayBuffer()))
      .rotate()
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
  } catch {
    return NextResponse.json({ error: "That file doesn't look like an image." }, { status: 400 });
  }

  const admin = createAdminClient();
  const filename = `design-${params.id}-${Date.now()}.jpg`;
  const { error } = await admin.storage.from("proofs").upload(filename, out, { contentType: "image/jpeg", upsert: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const { data } = admin.storage.from("proofs").getPublicUrl(filename);
  return NextResponse.json({ ok: true, url: data.publicUrl });
}
