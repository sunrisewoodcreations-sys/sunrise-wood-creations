import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://sunrisewoodcreations.com";
const PRODUCT_SLUGS = ["cornhole-boards", "wooden-signs", "planter-boxes", "cutting-boards"];

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, changeFrequency: "monthly", priority: 1 },
    ...PRODUCT_SLUGS.map(slug => ({
      url: `${SITE_URL}/products/${slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.8
    }))
  ];
}
