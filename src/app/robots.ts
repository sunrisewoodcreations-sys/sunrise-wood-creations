import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://sunrisewoodcreations.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/account", "/admin", "/login", "/update-password"]
    },
    sitemap: `${SITE_URL}/sitemap.xml`
  };
}
