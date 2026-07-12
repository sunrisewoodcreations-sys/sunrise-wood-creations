import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateCornholeDesign } from "@/lib/designGenerator";

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: adminProfile } = await supabase.from("profiles").select("role").eq("id", user?.id).single();

  if (adminProfile?.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const formData = await req.formData();
  const prompt = formData.get("prompt")?.toString().trim();
  const referenceFile = formData.get("referenceImage") as File | null;

  if (!prompt) {
    return NextResponse.json({ error: "A prompt is required" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Make sure the storage bucket exists — safe to call even if it's
  // already there, since we just ignore the "already exists" error.
  await admin.storage.createBucket("designs", { public: true }).catch(() => {});

  let referenceImageBuffer: Buffer | undefined;
  let referenceImageMimeType: string | undefined;
  let referenceImageUrl: string | null = null;

  if (referenceFile && referenceFile.size > 0) {
    referenceImageBuffer = Buffer.from(await referenceFile.arrayBuffer());
    referenceImageMimeType = referenceFile.type || "image/png";

    const refFilename = `reference-${Date.now()}.png`;
    const { error: refUploadError } = await admin.storage
      .from("designs")
      .upload(refFilename, referenceImageBuffer, { contentType: referenceImageMimeType, upsert: true });
    if (!refUploadError) {
      referenceImageUrl = admin.storage.from("designs").getPublicUrl(refFilename).data.publicUrl;
    }
  }

  let resultBuffer: Buffer;
  try {
    const rawBuffer = await generateCornholeDesign({
      prompt,
      referenceImageBuffer,
      referenceImageMimeType
    });

    // OpenAI's image sizes don't include an exact 24x48 (1:2) board
    // ratio — the tallest option it offers is closer to 2:3. Rather than
    // hand back a design that's the wrong shape for a real board, crop
    // it down to the correct 1:2 ratio here, keeping the centered
    // content (since prompts are written to keep the design centered).
    const metadata = await sharp(rawBuffer).metadata();
    const width = metadata.width || 1024;
    const height = metadata.height || 1536;
    const targetWidth = Math.round(height / 2);

    if (targetWidth < width) {
      const left = Math.round((width - targetWidth) / 2);
      resultBuffer = await sharp(rawBuffer)
        .extract({ left, top: 0, width: targetWidth, height })
        .toBuffer();
    } else {
      // Already narrower than 1:2 (unlikely) — leave as-is rather than
      // stretch or pad, which would distort or add blank space.
      resultBuffer = rawBuffer;
    }
  } catch (err: any) {
    console.error("Design generation failed:", err);
    return NextResponse.json({ error: err.message || "Generation failed" }, { status: 500 });
  }

  const resultFilename = `design-${Date.now()}.png`;
  const { error: uploadError } = await admin.storage
    .from("designs")
    .upload(resultFilename, resultBuffer, { contentType: "image/png", upsert: true });

  if (uploadError) {
    return NextResponse.json({ error: `Couldn't save the generated image: ${uploadError.message}` }, { status: 500 });
  }

  const resultImageUrl = admin.storage.from("designs").getPublicUrl(resultFilename).data.publicUrl;

  await admin.from("design_generations").insert({
    prompt,
    reference_image_url: referenceImageUrl,
    result_image_url: resultImageUrl
  });

  return NextResponse.json({ ok: true, imageUrl: resultImageUrl });
}
