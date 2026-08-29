import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_SITE_CONTENT, SiteContent, ProductKey, PRODUCT_ORDER } from "@/lib/siteContent";

// Same storage-upload pattern already proven by /api/carousel-images —
// same bucket, same admin-auth check, same "load the full row, change
// only the one thing being edited, save the full row back" safety
// property. The one real difference: a product only ever has a single
// imageUrl (not an array of slides), and its alt text is always just
// the product's own name (already true everywhere this image is used),
// so there's no separate alt-text field to manage here.
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: adminProfile } = await supabase.from("profiles").select("role").eq("id", user?.id).single();
  if (adminProfile?.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const formData = await req.formData();
  const productKey = formData.get("productKey") as string | null;
  const file = formData.get("file") as File | null;
  const removeImage = formData.get("remove") === "true";

  if (!productKey || !PRODUCT_ORDER.includes(productKey as ProductKey)) {
    return NextResponse.json({ error: "Invalid product" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: settingsRow } = await admin.from("site_settings").select("data").eq("id", 1).maybeSingle();
  const currentContent: SiteContent = (settingsRow?.data as SiteContent) || DEFAULT_SITE_CONTENT;

  const products = { ...currentContent.products };
  const key = productKey as ProductKey;
  const existing = products[key] || DEFAULT_SITE_CONTENT.products[key];

  if (removeImage) {
    products[key] = { ...existing, imageUrl: null };
  } else if (file) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `products/${key}-${Date.now()}.${ext}`;

    const { error: uploadError } = await admin.storage
      .from("site-images")
      .upload(path, buffer, { contentType: file.type || "image/jpeg", upsert: true });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data: publicUrlData } = admin.storage.from("site-images").getPublicUrl(path);
    products[key] = { ...existing, imageUrl: publicUrlData.publicUrl };
  } else {
    return NextResponse.json({ error: "Nothing to update — provide a file or remove=true." }, { status: 400 });
  }

  const updatedContent: SiteContent = { ...currentContent, products };

  const { error: saveError } = await admin.from("site_settings").upsert({ id: 1, data: updatedContent });
  if (saveError) {
    return NextResponse.json({ error: saveError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, products });
}
