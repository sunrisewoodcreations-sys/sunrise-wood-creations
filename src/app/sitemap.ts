import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_SITE_CONTENT, PRODUCT_ORDER, SiteContent } from "@/lib/siteContent";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://sunrisewoodcreations.com";

// Lists the home page, the custom-quote page, and only the product pages
// that are actually enabled (a disabled product's page returns 404, so it
// must not be listed). Falls back to the default content if the settings
// can't be read, so the sitemap never fails outright.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let content: SiteContent = DEFAULT_SITE_CONTENT;
  try {
    const supabase = createClient();
    const { data } = await supabase.from("site_settings").select("data").eq("id", 1).maybeSingle();
    if (data?.data) content = data.data as SiteContent;
  } catch {
    content = DEFAULT_SITE_CONTENT;
  }

  const enabledSlugs = PRODUCT_ORDER.filter(slug => content.products?.[slug]?.enabled);

  return [
    { url: SITE_URL, changeFrequency: "monthly", priority: 1 },
    ...enabledSlugs.map(slug => ({
      url: `${SITE_URL}/products/${slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.8
    })),
    { url: `${SITE_URL}/request-quote`, changeFrequency: "monthly", priority: 0.7 }
  ];
}
