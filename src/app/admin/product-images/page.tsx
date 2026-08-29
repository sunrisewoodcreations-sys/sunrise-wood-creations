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
    const images = product.images?.length ? product.images : DEFAULT_SITE_CONTENT.products[key].images;
    return { key, name: product.name, images };
  });

  return (
    <div>
      <h1 className="font-display text-2xl text-[#1E3A5F] mb-1">Product Photos</h1>
      <p className="text-sm text-[#1E3A5F]/60 mb-6">
        Upload real photos for each product's own gallery. They appear in the swipeable image carousel at the top of that
        product's page — just like the homepage carousel, once more than one slide has a photo you'll see arrows and dots
        for browsing between them. Any photo works, it's automatically cropped to a consistent shape, never stretched or
        distorted. Changes appear on the live site immediately after uploading.
      </p>
      <ProductImagesManager initialProducts={products} />
    </div>
  );
}
