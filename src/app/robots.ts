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

  // No more robots.txt "disallow" entries for /account, /admin, /login,
  // or /update-password. Blocking crawling there was well-intentioned
  // but self-defeating: a robots.txt "disallow" stops Google from
  // fetching the page at all, which means it can never see the
  // `noindex` meta tag those pages now carry (see their layout.tsx
  // files) — so a URL already in Google's index from before stays
  // stuck there, shown as "blocked by robots.txt," instead of actually
  // dropping out. There's no real exposure risk in allowing the crawl:
  // the middleware's own auth check (above) already sends every
  // signed-out visit to those paths straight to /login before any real
  // page ever renders, crawler or not.
  return {
    rules: {
      userAgent: "*",
      allow: "/"
    },
    sitemap: `${SITE_URL}/sitemap.xml`
  };
}
