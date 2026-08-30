import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_SITE_CONTENT, SiteContent, ProductKey, PRODUCT_ORDER, PRODUCT_KEY_TO_ORDER_TYPE } from "@/lib/siteContent";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import GuestChatWidget from "@/components/GuestChatWidget";
import TrackedLink from "@/components/TrackedLink";
import HeroCarousel from "@/components/HeroCarousel";
import OurWorkSection from "@/components/OurWorkSection";
import FaqAccordion from "@/components/FaqAccordion";
import AskQuestionForm from "@/components/AskQuestionForm";

export function generateStaticParams() {
  return PRODUCT_ORDER.map(slug => ({ slug }));
}

async function getContent(): Promise<SiteContent> {
  const supabase = createClient();
  const { data } = await supabase.from("site_settings").select("data").eq("id", 1).single();
  return (data?.data as SiteContent) || DEFAULT_SITE_CONTENT;
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const content = await getContent();
  const product = content.products[params.slug as ProductKey];
   if (!product || !product.enabled) return {};
  return {
    title: product.name,
    description: product.description,
    alternates: { canonical: `/products/${params.slug}` }
  };
}

export default async function ProductPage({ params }: { params: { slug: string } }) {
  const content = await getContent();
  const product = content.products[params.slug as ProductKey];
  if (!product || !product.enabled) notFound();

  // Only this category's own published FAQs — general FAQs are
  // deliberately excluded from every product page per the current
  // requirement, not shown everywhere by default.
  const supabase = createClient();
  const { data: categoryFaqs } = await supabase
    .from("faq_questions")
    .select("id, question, answer, category")
    .eq("status", "answered")
    .eq("is_public", true)
    .eq("category", params.slug)
    .order("sort_order", { ascending: true });

  // The expanded landing-page treatment below (What You Get, Make It
  // Yours, How It Works, Our Work, closing CTA) is scoped to the
  // cornhole page only — every other product page renders exactly as
  // it did before this change, since none of this content is inside
  // any shared markup. The gallery query only runs here too, so the
  // other 3 pages don't pay for a fetch they don't use.
  const isCornhole = params.slug === "cornhole-boards";
  const { data: galleryPhotos } = isCornhole
    ? await supabase.from("gallery_photos").select("*").order("sort_order", { ascending: true })
    : { data: null };

  // Mirrors the visible "← All products" trail above with no other
  // purpose than giving Google the same two-step path in structured
  // form — home, then this product — so search results can render a
  // breadcrumb instead of a raw URL. Same site-URL fallback pattern
  // already used for LocalBusiness in layout.tsx, kept consistent
  // rather than introducing a new convention for one page.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://sunrisewoodcreations.com";
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      { "@type": "ListItem", position: 2, name: product.name, item: `${siteUrl}/products/${params.slug}` }
    ]
  };

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <SiteHeader />
      <section className="max-w-5xl mx-auto px-6 py-16">
        <Link href="/" className="text-sm text-walnut/60 mb-4 inline-block">← All products</Link>
        <HeroCarousel slides={product.images?.length ? product.images : DEFAULT_SITE_CONTENT.products[params.slug as ProductKey].images} />
        <h1 className="font-display text-3xl md:text-4xl text-walnut mb-2">{product.name}</h1>
        <p className="text-lg text-ember font-medium mb-6">{product.tagline}</p>
        <p className="text-walnut/70 mb-8 leading-relaxed">{product.description}</p>
        <div className="flex flex-col sm:flex-row gap-3">
          <TrackedLink
            href={`/request-quote?type=${PRODUCT_KEY_TO_ORDER_TYPE[params.slug as ProductKey]}`}
            className="w-full sm:w-auto text-center inline-block bg-ember text-white px-7 py-3.5 rounded-md font-semibold hover:opacity-90 transition-opacity"
            eventName="request_quote_click"
            eventParams={{ location: "product_page", category: params.slug }}
          >
            Request a Custom Quote
          </TrackedLink>
          <TrackedLink
            href={`tel:${content.contact.phone.replace(/\D/g, "")}`}
            className="w-full sm:w-auto text-center inline-block border border-walnut text-walnut px-7 py-3.5 rounded-md font-semibold hover:bg-walnut/5 transition-colors"
            eventName="phone_click"
            eventParams={{ location: "product_page", category: params.slug }}
          >
            Call to get a quote: {content.contact.phone}
          </TrackedLink>
        </div>
        <p className="text-sm text-walnut/50 mt-4">📍 Local pickup only — Lawrence, MI</p>
      </section>

      {isCornhole && (
        <>
          {/* What You Get — every point here comes directly from the
              product's own confirmed FAQ answers (material, sizing,
              print method, design proof) — nothing added beyond what
              is already stated elsewhere on the site. */}
          <section className="max-w-4xl mx-auto px-6 py-14 md:py-20 border-t border-walnut/10">
            <h2 className="font-display text-2xl md:text-3xl text-walnut text-center mb-10">What You Get</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-8">
              {[
                { title: "Baltic birch plywood", description: "Both the playing tops and the frames — built for years of use, not a season." },
                { title: "Regulation-size boards", description: "Built to standard tournament dimensions." },
                { title: "UV-printed graphics", description: "Printed directly onto the surface — no vinyl wrap to peel, bubble, or warp." },
                { title: "A design proof to approve", description: "You see exactly what you're getting before we print anything." }
              ].map(item => (
                <div key={item.title} className="flex gap-3">
                  <span className="flex-shrink-0 w-2 h-2 rounded-full bg-ember mt-2.5" aria-hidden="true" />
                  <div>
                    <h3 className="font-display text-lg text-walnut mb-1">{item.title}</h3>
                    <p className="text-sm text-walnut/60">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Make It Yours — the exact four customization options
              already stated verbatim in this product's own description
              ("team colors, logos, family names, or whatever you have
              in mind"), just given their own visual space here. */}
          <section className="bg-sawdust/60 px-6 py-14 md:py-20">
            <div className="max-w-4xl mx-auto">
              <h2 className="font-display text-2xl md:text-3xl text-walnut text-center mb-10">Make It Yours</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {[
                  { title: "Team Colors", description: "Match your favorite team or your own color scheme." },
                  { title: "Your Logo", description: "Send us your artwork and we'll prep it for printing." },
                  { title: "Family Names", description: "A personalized set for game nights and backyard gatherings." },
                  { title: "Your Own Design", description: "Weddings, businesses, events — tell us your idea." }
                ].map(item => (
                  <div key={item.title} className="bg-white border border-walnut/10 rounded-xl p-5 text-center">
                    <h3 className="font-display text-base text-walnut mb-1.5">{item.title}</h3>
                    <p className="text-sm text-walnut/60">{item.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* How Your Custom Boards Come Together — mirrors the exact
              visual pattern already used for the homepage's "How It
              Works" section (numbered ember circles), and the step
              wording reflects the real design-proof-and-approval stage
              cornhole orders already go through (see statusSteps.ts:
              design_proof_sent, design_approved) — not a new claim,
              just the existing workflow described in plain language. */}
          <section className="max-w-4xl mx-auto px-6 py-14 md:py-20">
            <h2 className="font-display text-2xl md:text-3xl text-walnut text-center mb-10">How Your Custom Boards Come Together</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {[
                { title: "Tell Us What You Want", description: "Reach out with your idea — team colors, a logo, a family name, anything." },
                { title: "We Work Out the Details", description: "We'll go over sizing, colors, and design before anything gets built." },
                { title: "We Send You a Design Proof", description: "See exactly what your boards will look like before we print." },
                { title: "You Approve, We Build", description: "Once you approve the proof, we build and finish your boards by hand." }
              ].map((step, i) => (
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

          {/* Reuses the exact same OurWorkSection + gallery_photos
              already used on the homepage — same photos, same
              placeholder-when-empty behavior, same auto-update the
              moment real photos are uploaded via the admin gallery.
              Not filtered to cornhole specifically, since gallery_photos
              has no per-product tagging today. */}
          <OurWorkSection photos={galleryPhotos || []} />
        </>
      )}

      <section className="max-w-5xl mx-auto px-6 py-14 md:py-20 border-t border-walnut/10">
        <h2 className="font-display text-xl text-walnut mb-4">Frequently Asked Questions</h2>
        {categoryFaqs && categoryFaqs.length > 0 ? (
          <FaqAccordion items={categoryFaqs} />
        ) : (
          <div className="text-center text-walnut/50 border border-walnut/10 rounded-xl py-8 bg-sawdust/40">
            <p className="text-sm font-medium mb-1">Have a question we haven't answered?</p>
            <p className="text-xs text-walnut/40">Ask us below and we'll get back to you.</p>
          </div>
        )}
        <AskQuestionForm />
      </section>

      {isCornhole && (
        <section className="px-6 py-14 md:py-20 text-center bg-walnut">
          <h2 className="font-display text-2xl md:text-3xl text-cream mb-3">Have an idea for your boards? Let's build it.</h2>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-xs sm:max-w-none mx-auto mb-4">
            <TrackedLink
              href={`/request-quote?type=${PRODUCT_KEY_TO_ORDER_TYPE["cornhole-boards"]}`}
              className="w-full sm:w-auto text-center inline-block bg-ember text-white px-7 py-3.5 rounded-md font-semibold hover:opacity-90 transition-opacity"
              eventName="request_quote_click"
              eventParams={{ location: "product_page_closing_cta", category: "cornhole-boards" }}
            >
              Request a Custom Quote
            </TrackedLink>
            <TrackedLink
              href={`tel:${content.contact.phone.replace(/\D/g, "")}`}
              className="w-full sm:w-auto text-center inline-block border border-cream text-cream px-7 py-3.5 rounded-md font-semibold hover:bg-white/10 transition-colors"
              eventName="phone_click"
              eventParams={{ location: "product_page_closing_cta", category: "cornhole-boards" }}
            >
              Call: {content.contact.phone}
            </TrackedLink>
          </div>
          <p className="text-sm text-cream/60">📍 Local pickup only — Lawrence, MI</p>
        </section>
      )}
      <SiteFooter />
      <GuestChatWidget />
    </div>
  );
}
