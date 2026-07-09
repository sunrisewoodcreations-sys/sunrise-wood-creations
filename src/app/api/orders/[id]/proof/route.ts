import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendProofReadyEmail } from "@/lib/email";

async function watermarkImage(original: Buffer, text: string): Promise<Buffer> {
  const image = sharp(original);
  const metadata = await image.metadata();
  const width = metadata.width || 1000;
  const height = metadata.height || 1000;

  const fontSize = Math.max(20, Math.round(width / 18));
  const stepX = fontSize * (text.length * 0.65);
  const stepY = fontSize * 3.5;

  let tiles = "";
  for (let y = 0; y < height + stepY; y += stepY) {
    for (let x = -stepX; x < width + stepX; x += stepX) {
      tiles += `<text x="${x}" y="${y}" font-size="${fontSize}" fill="white" fill-opacity="0.35" font-family="sans-serif" transform="rotate(-30 ${x} ${y})">${text}</text>`;
    }
  }

  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${tiles}</svg>`;

  return image
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 88 })
    .toBuffer();
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: adminProfile } = await supabase.from("profiles").select("role").eq("id", user?.id).single();

  if (adminProfile?.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { imageUrl } = await req.json();
  if (!imageUrl?.trim()) {
    return NextResponse.json({ error: "Image URL is required" }, { status: 400 });
  }

  const { data: order } = await supabase
    .from("orders")
    .select("*, profiles:customer_id(email, full_name)")
    .eq("id", params.id)
    .single();

  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  let watermarkedUrl = imageUrl.trim();
  try {
    const imgRes = await fetch(imageUrl.trim());
    console.log("Image fetch status:", imgRes.status, imgRes.ok);
    if (imgRes.ok) {
      const original = Buffer.from(await imgRes.arrayBuffer());
      const watermarked = await watermarkImage(original, "Sunrise Wood Creations");

      const admin = createAdminClient();
      const filename = `proof-${order.id}-${Date.now()}.jpg`;
      const { error: uploadError } = await admin.storage
        .from("proofs")
        .upload(filename, watermarked, { contentType: "image/jpeg", upsert: true });

      if (uploadError) {
        console.error("Storage upload failed:", uploadError.message);
      } else {
        const { data: publicUrlData } = admin.storage.from("proofs").getPublicUrl(filename);
        watermarkedUrl = publicUrlData.publicUrl;
        console.log("Watermarked URL:", watermarkedUrl);
      }
    }
  } catch (err) {
    console.error("Watermarking failed:", err);
  }

  const { data: newProof, error: insertError } = await supabase
    .from("proofs")
    .insert({ order_id: order.id, image_url: watermarkedUrl })
    .select()
    .single();

  if (insertError || !newProof) {
    return NextResponse.json({ error: insertError?.message || "Couldn't create the proof" }, { status: 400 });
  }

  const customer = (order as any).profiles;
  await sendProofReadyEmail({
    toEmail: customer.email,
    customerName: customer.full_name,
    orderTitle: order.title,
    orderId: order.id,
    imageUrl: watermarkedUrl,
    respondToken: newProof.respond_token
  });

  return NextResponse.json({ ok: true });
}
