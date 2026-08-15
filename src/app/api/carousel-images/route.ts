import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_SITE_CONTENT, SiteContent } from "@/lib/siteContent";

// Same storage upload pattern already proven for shop-floor progress
// photos (bucket + upload + getPublicUrl) — no new upload mechanism
// invented here. The one thing this route is careful about: it loads
// the FULL current site_settings row first and only ever changes the
// one carousel slot being edited, so the headline, products, Why Us
// section, and everything else in site_settings passes through
// completely untouched, never accidentally overwritten.
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: adminProfile } = await supabase.from("profiles").select("role").eq("id", user?.id).single();
  if (adminProfile?.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const formData = await req.formData();
  const slotIndex = Number(formData.get("slotIndex"));
  const file = formData.get("file") as File | null;
  const altTextRaw = formData.get("alt");
  const altText = typeof altTextRaw === "string" ? altTextRaw : null;
  const removeImage = formData.get("remove") === "true";

  if (!Number.isInteger(slotIndex) || slotIndex < 0) {
    return NextResponse.json({ error: "Invalid slot index" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: settingsRow } = await admin.from("site_settings").select("data").eq("id", 1).maybeSingle();
  const currentContent: SiteContent = (settingsRow?.data as SiteContent) || DEFAULT_SITE_CONTENT;

  const slides = [...(currentContent.hero?.carouselSlides || DEFAULT_SITE_CONTENT.hero.carouselSlides)];
  while (slides.length <= slotIndex) {
    slides.push({ src: null, alt: "A Sunrise Wood Creations project" });
  }

  if (removeImage) {
    slides[slotIndex] = { src: null, alt: slides[slotIndex]?.alt || "A Sunrise Wood Creations project" };
  } else if (file) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `carousel/slide-${slotIndex}-${Date.now()}.${ext}`;

    const { error: uploadError } = await admin.storage
      .from("site-images")
      .upload(path, buffer, { contentType: file.type || "image/jpeg", upsert: true });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data: publicUrlData } = admin.storage.from("site-images").getPublicUrl(path);
    slides[slotIndex] = {
      src: publicUrlData.publicUrl,
      alt: altText?.trim() || slides[slotIndex]?.alt || "A Sunrise Wood Creations project"
    };
  } else if (altText !== null) {
    // Alt-text-only edit, no new file this time.
    slides[slotIndex] = { ...slides[slotIndex], alt: altText.trim() || slides[slotIndex]?.alt };
  } else {
    return NextResponse.json({ error: "Nothing to update — provide a file, alt text, or remove=true." }, { status: 400 });
  }

  const updatedContent: SiteContent = {
    ...currentContent,
    hero: { ...currentContent.hero, carouselSlides: slides }
  };

  const { error: saveError } = await admin.from("site_settings").upsert({ id: 1, data: updatedContent });
  if (saveError) {
    return NextResponse.json({ error: saveError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, slides });
}
