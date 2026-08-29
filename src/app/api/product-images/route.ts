import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_SITE_CONTENT, SiteContent, ProductKey, PRODUCT_ORDER } from "@/lib/siteContent";

// Same storage-upload pattern already proven by /api/carousel-images —
// same bucket, same admin-auth check, same "load the full row, change
// only the one slot being edited, save the full row back" safety
// property. The only real difference from that route: slots live
// under a specific product (productKey) instead of directly under
// hero, so both a product and a slot index are required here.
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: adminProfile } = await supabase.from("profiles").select("role").eq("id", user?.id).single();
  if (adminProfile?.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const formData = await req.formData();
  const productKey = formData.get("productKey") as string | null;
  const slotIndex = Number(formData.get("slotIndex"));
  const file = formData.get("file") as File | null;
  const altTextRaw = formData.get("alt");
  const altText = typeof altTextRaw === "string" ? altTextRaw : null;
  const removeImage = formData.get("remove") === "true";

  if (!productKey || !PRODUCT_ORDER.includes(productKey as ProductKey)) {
    return NextResponse.json({ error: "Invalid product" }, { status: 400 });
  }
  if (!Number.isInteger(slotIndex) || slotIndex < 0) {
    return NextResponse.json({ error: "Invalid slot index" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: settingsRow } = await admin.from("site_settings").select("data").eq("id", 1).maybeSingle();
  const currentContent: SiteContent = (settingsRow?.data as SiteContent) || DEFAULT_SITE_CONTENT;

  const key = productKey as ProductKey;
  const existingProduct = currentContent.products?.[key] || DEFAULT_SITE_CONTENT.products[key];
  const defaultAlt = DEFAULT_SITE_CONTENT.products[key].images[0]?.alt || `${existingProduct.name} built by Sunrise Wood Creations`;

  const images = [...(existingProduct.images?.length ? existingProduct.images : DEFAULT_SITE_CONTENT.products[key].images)];
  while (images.length <= slotIndex) {
    images.push({ src: null, alt: defaultAlt });
  }

  if (removeImage) {
    images[slotIndex] = { src: null, alt: images[slotIndex]?.alt || defaultAlt };
  } else if (file) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `products/${key}-${slotIndex}-${Date.now()}.${ext}`;

    const { error: uploadError } = await admin.storage
      .from("site-images")
      .upload(path, buffer, { contentType: file.type || "image/jpeg", upsert: true });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data: publicUrlData } = admin.storage.from("site-images").getPublicUrl(path);
    images[slotIndex] = {
      src: publicUrlData.publicUrl,
      alt: altText?.trim() || images[slotIndex]?.alt || defaultAlt
    };
  } else if (altText !== null) {
    // Alt-text-only edit, no new file this time.
    images[slotIndex] = { ...images[slotIndex], alt: altText.trim() || images[slotIndex]?.alt || defaultAlt };
  } else {
    return NextResponse.json({ error: "Nothing to update — provide a file, alt text, or remove=true." }, { status: 400 });
  }

  const updatedContent: SiteContent = {
    ...currentContent,
    products: {
      ...currentContent.products,
      [key]: { ...existingProduct, images }
    }
  };

  const { error: saveError } = await admin.from("site_settings").upsert({ id: 1, data: updatedContent });
  if (saveError) {
    return NextResponse.json({ error: saveError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, images });
}
