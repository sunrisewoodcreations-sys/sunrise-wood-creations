import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { randomUUID } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

// Public: lets a customer attach an optional reference photo (logo, inspiration)
// to a quote request. Only real images are accepted; each is re-encoded as a
// resized JPEG so nothing else can be stored. Uses the existing public
// "proofs" bucket under a "quote-ref-" prefix.
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("image") as File | null;
  if (!file) return NextResponse.json({ error: "No image provided" }, { status: 400 });
  if (file.size > 20 * 1024 * 1024) return NextResponse.json({ error: "That photo is too large (20 MB max)." }, { status: 400 });

  let out: Buffer;
  try {
    out = await sharp(Buffer.from(await file.arrayBuffer()))
      .rotate()
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 85 })
      .toBuffer();
  } catch {
    return NextResponse.json({ error: "That file doesn't look like a photo or image." }, { status: 400 });
  }

  const admin = createAdminClient();
  const filename = `quote-ref-${randomUUID()}.jpg`;
  const { error } = await admin.storage.from("proofs").upload(filename, out, { contentType: "image/jpeg" });
  if (error) return NextResponse.json({ error: "Couldn't upload that photo. Try again." }, { status: 500 });
  const { data } = admin.storage.from("proofs").getPublicUrl(filename);
  return NextResponse.json({ ok: true, url: data.publicUrl });
}
