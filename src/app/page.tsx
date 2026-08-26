import Image from "next/image";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_SITE_CONTENT, SiteContent, PRODUCT_ORDER } from "@/lib/siteContent";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import GuestChatWidget from "@/components/GuestChatWidget";
import ProductCard from "@/components/ProductCard";
import TrackedLink from "@/components/TrackedLink";
import HeroCarousel from "@/components/HeroCarousel";
import OurWorkSection from "@/components/OurWorkSection";
import PublicReviewsSection from "@/components/PublicReviewsSection";
import FaqAccordion from "@/components/FaqAccordion";
import AskQuestionForm from "@/components/AskQuestionForm";

export const metadata: Metadata = {
  title: "Custom cornhole boards, wooden signs, planters & cutting boards",
  description:
    "Sunrise Wood Creations builds handcrafted, made-to-order cornhole boards, wooden signs, planter boxes, and cutting boards in Michigan. Request a custom order today."
};

export default async function HomePage() {
  const supabase = createClient();

  const { data: settingsRow } = await supabase.from("site_settings").select("data").eq("id", 1).single();
  const savedContent = (settingsRow?.data as Partial<SiteContent>) || {};
  const content: SiteContent = {
    ...DEFAULT_SITE_CONTENT,
    ...savedContent,
    hero: { ...DEFAULT_SITE_CONTENT.hero, ...savedContent.hero },
    contact: { ...DEFAULT_SITE_CONTENT.contact, ...savedContent.contact },
    howItWorks: { ...DEFAULT_SITE_CONTENT.howItWorks, ...savedContent.howItWorks },
    whyUs: { ...DEFAULT_SITE_CONTENT.whyUs, ...savedContent.whyUs },
    customCta: { ...DEFAULT_SITE_CONTENT.customCta, ...savedContent.customCta }
  };
  const visibleProducts = PRODUCT_ORDER
    .map(key => ({ slug: key, ...DEFAULT_SITE_CONTENT.products[key], ...content.products?.[key] }))
    .filter(p => p.enabled);

  const { data: galleryPhotos } = await supabase.from("gallery_photos").select("*").order("sort_order", { ascending: true });

  const { data: approvedReviews } = await supabase.from("product_reviews").select("*").eq("status", "approved").order("created_at", { ascending: false });
  const reviewList = approvedReviews || [];
  const reviewItemIds = [...new Set(reviewList.map((r: any) => r.order_item_id))];
  const reviewCustomerIds = [...new Set(reviewList.map((r: any) => r.customer_id))];
  const { data: reviewOrderItems } = reviewItemIds.length > 0
    ? await supabase.from("order_items").select("id, title").in("id", reviewItemIds)
    : { data: [] as any[] };
  const { data: reviewCustomers } = reviewCustomerIds.length > 0
    ? await supabase.from("profiles").select("id, full_name").in("id", reviewCustomerIds)
    : { data: [] as any[] };
  const reviewItemTitleById: Record<string, string> = {};
  (reviewOrderItems || []).forEach((i: any) => { reviewItemTitleById[i.id] = i.title; });
  const reviewCustomerNameById: Record<string, string> = {};
  (reviewCustomers || []).forEach((c: any) => { reviewCustomerNameById[c.id] = c.full_name; });
  const publicReviews = reviewList.map((r: any) => ({
    id: r.id,
    rating: r.rating,
    review_text: r.review_text,
    productTitle: reviewItemTitleById[r.order_item_id] || "a custom piece",
    customerFirstName: (reviewCustomerNameById[r.customer_id] || "A customer").split(" ")[0]
  }));

  const { data: publicFaqRows } = await supabase
    .from("faq_questions")
    .select("id, question, answer, category")
    .eq("status", "answered")
    .eq("is_public", true)
    .order("category", { ascending: true })
    .order("sort_order", { ascending: true });

  return (
    <div>
      <SiteHeader />

      <section className="text-center px-6 pt-10 pb-12 sm:py-16 md:py-20 bg-gradient-to-b from-amber/10 to-cream">
        <HeroCarousel slides={content.hero.carouselSlides} />
        <Image
          src="/logo-full.png"
          alt="Sunrise Wood Creations — Handcrafted. Built to last."
          width={1000}
          height={1000}
          priority
          className="w-28 sm:w-56 md:w-72 h-auto mx-auto mb-5 sm:mb-6"
        />
        <h1 className="font-display text-3xl sm:text-4xl md:text-5xl text-walnut font-semibold mb-3 sm:mb-4 whitespace-pre-line">
          {content.hero.heading}
        </h1>
        <p className="text-walnut/70 max-w-lg mx-auto mb-7 text-[15px] sm:text-base">
          {content.hero.subheading}
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-xs sm:max-w-none mx-auto">
          <TrackedLink
            href="/request-quote"
            className="w-full sm:w-auto inline-block bg-ember text-white px-7 py-3.5 rounded-md font-semibold hover:opacity-90 transition-opacity"
            eventName="request_quote_click"
            eventParams={{ location: "hero" }}
          >
            {content.hero.ctaText}
          </TrackedLink>
          <TrackedLink
            href="#products"
            className="w-full sm:w-auto inline-block border border-walnut text-walnut px-7 py-3.5 rounded-md font-semibold hover:bg-walnut/5 transition-colors"
            eventName="view_work_click"
          >
            {content.hero.secondaryCtaText}
          </TrackedLink>
        </div>
      </section>

      <section id="products" className="max-w-5xl mx-auto px-6 py-14 md:py-20 scroll-mt-16">
        <h2 className="font-display text-2xl md:text-3xl text-walnut text-center mb-2">What we build</h2>
        <p className="text-center text-walnut/60 mb-10">Every piece is made to order.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {visibleProducts.map(p => (
            <ProductCard
              key={p.slug}
              slug={p.slug}
              name={p.name}
              shortDesc={p.shortDesc}
              imageUrl={p.imageUrl}
              featured={p.slug === "planter-boxes"}
            />
          ))}
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-6 py-14 md:py-20">
        <h2 className="font-display text-2xl md:text-3xl text-walnut text-center mb-10">{content.howItWorks.heading}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          {content.howItWorks.steps.map((step, i) => (
            <div key={step.title} className="text-center">
              <div className="w-10 h-10 rounded-full bg-ember text-white font-display text-lg flex items-center justify-center mx-auto mb-3">
                {i + 1}
              </div>
              <h3 className="font-display text-lg text-walnut mb-1">{step.title}</h3>
              <p className="text-sm text-walnut/60">{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      <OurWorkSection photos={galleryPhotos || []} />

      <section className="bg-sawdust/60 px-6 py-14 md:py-20">
        <div className="max-w-4xl mx-auto">
          <h2 className="font-display text-2xl md:text-3xl text-walnut text-center mb-10">{content.whyUs.heading}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-8">
            {content.whyUs.items.map(item => (
              <div key={item.title} className="flex gap-3">
                <span className="flex-shrink-0 w-2 h-2 rounded-full bg-ember mt-2.5" aria-hidden="true" />
                <div>
                  <h3 className="font-display text-lg text-walnut mb-1">{item.title}</h3>
                  <p className="text-sm text-walnut/60">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <PublicReviewsSection reviews={publicReviews} />

      <section className="px-6 py-14 md:py-20">
        <h2 className="font-display text-2xl md:text-3xl text-walnut text-center mb-2">Frequently Asked Questions</h2>
        <p className="text-center text-walnut/60 mb-10">Common questions about ordering, customization, and pickup.</p>
        <FaqAccordion items={publicFaqRows || []} />
        <AskQuestionForm />
      </section>

      <section className="px-6 py-14 md:py-20 text-center bg-walnut">
        <h2 className="font-display text-2xl md:text-3xl text-cream mb-3">{content.customCta.heading}</h2>
        <p className="text-cream/70 max-w-md mx-auto mb-7">{content.customCta.subheading}</p>
        <TrackedLink
          href="/request-quote"
          className="inline-block bg-ember text-white px-7 py-3.5 rounded-md font-semibold hover:opacity-90 transition-opacity"
          eventName="request_quote_click"
          eventParams={{ location: "bottom_cta" }}
        >
          {content.customCta.ctaText}
        </TrackedLink>
      </section>

      <SiteFooter />
      <GuestChatWidget />
    </div>
  );
}
