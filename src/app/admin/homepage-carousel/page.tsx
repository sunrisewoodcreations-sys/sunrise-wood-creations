import { createClient } from "@/lib/supabase/server";
import { DEFAULT_SITE_CONTENT, SiteContent } from "@/lib/siteContent";
import CarouselSlidesManager from "@/components/CarouselSlidesManager";

export const dynamic = "force-dynamic";

export default async function HomepageCarouselPage() {
  const supabase = createClient();
  const { data: settingsRow } = await supabase.from("site_settings").select("data").eq("id", 1).maybeSingle();
  const content: SiteContent = (settingsRow?.data as SiteContent) || DEFAULT_SITE_CONTENT;
  const slides = content.hero?.carouselSlides || DEFAULT_SITE_CONTENT.hero.carouselSlides;

  return (
    <div>
      <h1 className="font-display text-2xl text-[#1E3A5F] mb-1">Homepage Carousel</h1>
      <p className="text-sm text-[#1E3A5F]/60 mb-6">
        Upload real project photos for the image carousel at the top of the homepage. Any photo works — it's automatically
        cropped to a consistent shape, never stretched or distorted. Changes appear on the live site immediately after uploading.
      </p>
      <CarouselSlidesManager initialSlides={slides} />
    </div>
  );
}
