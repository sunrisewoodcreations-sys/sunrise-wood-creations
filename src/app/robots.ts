import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://sunrisewoodcreations.com";

// Was previously static and had no idea Coming Soon mode existed —
// meaning Google could have been told the real pages were indexable
// even while the site was intentionally locked. Now checks the same
// site_settings value the middleware itself checks, so the two stay
// consistent: while Coming Soon is active, everything is disallowed;
// once Live, the original allow-with-exceptions rules apply exactly
// as before.
export default async function robots(): Promise<MetadataRoute.Robots> {
  const supabase = createClient();
  const { data: settingsRow } = await supabase.from("site_settings").select("data").eq("id", 1).maybeSingle();
  const websiteStatus = (settingsRow?.data as any)?.websiteStatus;

  if (websiteStatus === "coming_soon") {
    return {
      rules: { userAgent: "*", disallow: "/" }
    };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/account", "/admin", "/login", "/update-password"]
    },
    sitemap: `${SITE_URL}/sitemap.xml`
  };
}
