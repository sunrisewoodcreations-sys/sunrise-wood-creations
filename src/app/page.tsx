import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_SITE_CONTENT, SiteContent, PRODUCT_ORDER } from "@/lib/siteContent";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import GuestChatWidget from "@/components/GuestChatWidget";
import ProductTile from "@/components/ProductTile";
import TrackedLink from "@/components/TrackedLink";
import HeroCarousel from "@/components/HeroCarousel";
import OurWorkSection from "@/components/OurWorkSection";
import PublicReviewsSection from "@/components/PublicReviewsSection";
import FaqAccordion from "@/components/FaqAccordion";
import AskQuestionForm from "@/components/AskQuestionForm";

export const metadata: Metadata = {
  title: "Custom cornhole boards, wooden signs, planters & cutting boards",
  description:
    "Handcrafted, made-to-order cornhole boards, wooden signs, planter boxes, and cutting boards built in Michigan. Request a custom order today.",
  alternates: { canonical: "/" }
};

const iconProps = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const WHY_ICONS = [
  <svg key="pin" {...iconProps}><path d="M12 21s-7-6.2-7-11a7 7 0 0114 0c0 4.8-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></svg>,
  <svg key="clock" {...iconProps}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>,
  <svg key="pencil" {...iconProps}><path d="M4 20l4-1L19 8l-3-3L5 16z" /><path d="M14 7l3 3" /></svg>,
  <svg key="star" {...iconProps}><path d="M12 3l2.6 5.5 6 .8-4.4 4.2 1.1 6L12 16.6 6.7 19.5l1.1-6L3.4 9.3l6-.8z" /></svg>
];

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
    .eq("show_on_homepage", true)
    .order("category", { ascending: true })
    .order("sort_order", { ascending: true })
    .limit(6);

  return (
    <div>
      <SiteHeader />
      <main>

      <div className="flex items-center justify-center gap-3 px-4 py-3.5 bg-cream text-walnut">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="flex-shrink-0">
          <path d="M3 21l7-7M14 4l6 6-9 9-6-6z" /><path d="M13 7l4 4" />
        </svg>
        <p className="font-bold text-[13px] sm:text-sm tracking-wide uppercase leading-snug">
          Handmade in Michigan. Built to order, one piece at a time.
        </p>
      </div>

      <section className="text-center px-6 pt-0 pb-2 sm:pt-6 md:pt-8 bg-gradient-to-b from-sawdust to-cream">
        <div className="mb-8 sm:mb-10 -mx-6 sm:mx-0">
          <HeroCarousel slides={content.hero.carouselSlides} label="Featured Sunrise Wood Creations projects" />
        </div>
        <h1 className="font-display text-3xl sm:text-4xl md:text-5xl text-walnut font-semibold mb-3 sm:mb-4 whitespace-pre-line">
          {content.hero.heading}
        </h1>
        <p className="text-walnut/70 max-w-lg mx-auto mb-7 text-[15px] sm:text-base">
          {content.hero.subheading}
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-xs sm:max-w-none mx-auto">
          <TrackedLink
            href="/request-quote"
            className="w-full sm:w-auto inline-block bg-accent text-white px-7 py-3.5 rounded-md font-semibold hover:opacity-90 transition-opacity"
            eventName="request_quote_click"
            eventParams={{ location: "hero" }}
          >
            {content.hero.ctaText}
          </TrackedLink>
          <TrackedLink
            href="#gallery"
            className="w-full sm:w-auto inline-block border border-walnut text-walnut px-7 py-3.5 rounded-md font-semibold hover:bg-walnut/5 transition-colors"
            eventName="view_work_click"
          >
            {content.hero.secondaryCtaText}
          </TrackedLink>
        </div>
        <p className="text-[13px] text-walnut/70 mt-5 pb-8 sm:pb-12">
          <span className="whitespace-nowrap">Handmade in Michigan • Built to order</span>
          <br className="sm:hidden" />
          <span className="hidden sm:inline"> • </span>
          <span className="whitespace-nowrap">Local pickup in Lawrence, MI</span>
        </p>
      </section>

      <section id="products" className="max-w-5xl mx-auto px-6 py-10 sm:py-14 md:py-20 scroll-mt-20">
        <h2 className="font-display text-2xl md:text-3xl text-walnut text-center mb-2">What we build</h2>
        <p className="text-center text-walnut/70 mb-8 sm:mb-10">Every piece is made to order.</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-8 sm:gap-x-6">
          {visibleProducts.map(p => (
            <ProductTile
              key={p.slug}
              slug={p.slug}
              name={p.name}
              shortDesc={p.shortDesc}
              imageUrl={p.images?.[0]?.src ?? null}
            />
          ))}
        </div>
      </section>

      <section id="about" className="bg-walnut px-6 py-10 sm:py-14 md:py-20 scroll-mt-20">
        <div className="max-w-4xl mx-auto">
          <h2 className="font-display text-2xl md:text-3xl text-cream text-center mb-8 sm:mb-10">{content.whyUs.heading}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-8">
            {content.whyUs.items.map((item, i) => (
              <div key={item.title} className="flex gap-3.5 items-start">
                <span className="flex-shrink-0 w-11 h-11 rounded-full border-[1.5px] border-amber text-amber flex items-center justify-center" aria-hidden="true">
                  {WHY_ICONS[i % WHY_ICONS.length]}
                </span>
                <div>
                  <h3 className="font-bold text-[15px] tracking-wide uppercase text-amber mb-1">{item.title}</h3>
                  <p className="text-sm text-cream/80 leading-relaxed">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <OurWorkSection photos={galleryPhotos || []} />

      <section className="max-w-4xl mx-auto px-6 py-10 sm:py-14 md:py-20 border-t border-walnut/10">
        <h2 className="font-display text-2xl md:text-3xl text-walnut text-center mb-8 sm:mb-10">{content.howItWorks.heading}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {content.howItWorks.steps.map((step, i) => (
            <div key={step.title} className="text-center">
              <div className="w-10 h-10 rounded-full bg-accent text-white font-display text-lg flex items-center justify-center mx-auto mb-3">
                {i + 1}
              </div>
              <h3 className="font-display text-lg text-walnut mb-1">{step.title}</h3>
              <p className="text-sm text-walnut/70">{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      <PublicReviewsSection reviews={publicReviews} />

      <section id="faq" className="px-6 py-10 sm:py-14 md:py-20 scroll-mt-20">
        <h2 className="font-display text-2xl md:text-3xl text-walnut text-center mb-2">Frequently Asked Questions</h2>
        <p className="text-center text-walnut/70 mb-8 sm:mb-10">Common questions about ordering, customization, and pickup.</p>
        <FaqAccordion items={publicFaqRows || []} forceFlat />
        <AskQuestionForm />
      </section>

      <section className="px-6 py-10 sm:py-14 md:py-20 text-center bg-walnut">
        <h2 className="font-display text-2xl md:text-3xl text-cream mb-3">{content.customCta.heading}</h2>
        <p className="text-cream/70 max-w-md mx-auto mb-7">{content.customCta.subheading}</p>
        <TrackedLink
          href="/request-quote"
          className="inline-block bg-accent text-white px-7 py-3.5 rounded-md font-semibold hover:opacity-90 transition-opacity"
          eventName="request_quote_click"
          eventParams={{ location: "bottom_cta" }}
        >
          {content.customCta.ctaText}
        </TrackedLink>
      </section>

      </main>
      <SiteFooter />
      <GuestChatWidget />
    </div>
  );
}
