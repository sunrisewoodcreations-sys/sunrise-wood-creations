import { createClient } from "@/lib/supabase/server";
import { DEFAULT_SITE_CONTENT, SiteContent, PRODUCT_ORDER } from "@/lib/siteContent";
import ProductImagesManager from "@/components/ProductImagesManager";

export const dynamic = "force-dynamic";

export default async function ProductImagesPage() {
  const supabase = createClient();
  const { data: settingsRow } = await supabase.from("site_settings").select("data").eq("id", 1).maybeSingle();
  const content: SiteContent = (settingsRow?.data as SiteContent) || DEFAULT_SITE_CONTENT;

  const products = PRODUCT_ORDER.map(key => {
    const product = content.products?.[key] || DEFAULT_SITE_CONTENT.products[key];
    return { key, name: product.name, imageUrl: product.imageUrl };
  });

  return (
    <div>
      <h1 className="font-display text-2xl text-[#1E3A5F] mb-1">Product Photos</h1>
      <p className="text-sm text-[#1E3A5F]/60 mb-6">
        Upload a real photo for each product category. It appears in the image carousel at the top of that product's page —
        any photo works, it's automatically cropped to a consistent shape, never stretched or distorted. Changes appear on
        the live site immediately after uploading.
      </p>
      <ProductImagesManager initialProducts={products} />
    </div>
  );
}
