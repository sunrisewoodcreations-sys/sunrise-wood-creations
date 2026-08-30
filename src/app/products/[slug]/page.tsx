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

// Every fact below is sourced from this product's own live description
// or its own published, answered FAQs (see the site's FAQ admin page) —
// nothing here is invented. Cornhole is the only product whose orders
// actually go through a design-proof-and-approval stage before
// building (see statusSteps.ts: CORNHOLE_STEPS vs. STANDARD_STEPS for
// the other three) — so it's the only one that mentions a design proof
// in its workflow; the other three correctly describe the standard
// order → build → pickup flow instead.
const PRODUCT_LANDING_CONTENT: Record<ProductKey, {
  ctaNoun: string;
  whatYouGet: { title: string; description: string }[];
  makeItYours: { title: string; description: string }[];
  howItWorksHeading: string;
  howItWorks: { title: string; description: string }[];
}> = {
  "cornhole-boards": {
    ctaNoun: "your boards",
    whatYouGet: [
      { title: "Baltic birch plywood", description: "Both the playing tops and the frames — built for years of use, not a season." },
      { title: "Regulation-size boards", description: "Built to standard tournament dimensions." },
      { title: "UV-printed graphics", description: "Printed directly onto the surface — no vinyl wrap to peel, bubble, or warp." },
      { title: "A design proof to approve", description: "You see exactly what you're getting before we print anything." }
    ],
    makeItYours: [
      { title: "Team Colors", description: "Match your favorite team or your own color scheme." },
      { title: "Your Logo", description: "Send us your artwork and we'll prep it for printing." },
      { title: "Family Names", description: "A personalized set for game nights and backyard gatherings." },
      { title: "Your Own Design", description: "Weddings, businesses, events — tell us your idea." }
    ],
    howItWorksHeading: "How Your Custom Boards Come Together",
    howItWorks: [
      { title: "Tell Us What You Want", description: "Reach out with your idea — team colors, a logo, a family name, anything." },
      { title: "We Work Out the Details", description: "We'll go over sizing, colors, and design before anything gets built." },
      { title: "We Send You a Design Proof", description: "See exactly what your boards will look like before we print." },
      { title: "You Approve, We Build", description: "Once you approve the proof, we build and finish your boards by hand." }
    ]
  },
  "wooden-signs": {
    ctaNoun: "your sign",
    whatYouGet: [
      { title: "Cut, sanded, and finished by hand", description: "Every sign is made one at a time, not mass-produced." },
      { title: "Your own wording", description: "You choose exactly what the sign says." },
      { title: "Sized to fit your space", description: "Made in the dimensions that work for where it's going." },
      { title: "Indoor or outdoor options", description: "We'll talk through materials and finishes suited to where it'll hang." }
    ],
    makeItYours: [
      { title: "Custom Wording", description: "Family names, quotes, or a message of your choice." },
      { title: "Your Logo or Artwork", description: "Send us your design and we'll work it into the sign." },
      { title: "Color & Finish", description: "Many signs can be finished in the colors you're looking for." },
      { title: "Business or Event Signage", description: "Branding, weddings, parties, and other special occasions." }
    ],
    howItWorksHeading: "How Your Custom Sign Comes Together",
    howItWorks: [
      { title: "Tell Us What You Want", description: "Share your wording, size, and style." },
      { title: "We Work Out the Details", description: "We'll go over layout, colors, and finish before anything gets built." },
      { title: "We Build It", description: "Every sign is cut, sanded, and finished by hand." },
      { title: "Pick It Up", description: "We'll let you know as soon as it's ready." }
    ]
  },
  "planter-boxes": {
    ctaNoun: "your planter",
    whatYouGet: [
      { title: "Weather-resistant wood", description: "Cedar is a common choice, built to hold up outdoors season after season." },
      { title: "Built-in drainage", description: "Designed with proper drainage for healthy plants." },
      { title: "Sized to fit your space", description: "Give us your available space and we'll work out the dimensions." },
      { title: "Finished for outdoor use", description: "Made for porches, patios, decks, and gardens." }
    ],
    makeItYours: [
      { title: "Custom Dimensions", description: "Built to fit the exact space you have in mind." },
      { title: "Cedar or Other Wood", description: "Selected for outdoor durability." },
      { title: "Color & Finish", description: "Tell us the look you're going for when requesting your quote." },
      { title: "Built for Your Space", description: "Porch, patio, deck, or garden — made to fit." }
    ],
    howItWorksHeading: "How Your Custom Planter Comes Together",
    howItWorks: [
      { title: "Tell Us What You Want", description: "Share your space, size, and style." },
      { title: "We Work Out the Details", description: "We'll go over dimensions, wood, and finish before anything gets built." },
      { title: "We Build It", description: "Every planter is built and finished by hand for outdoor use." },
      { title: "Pick It Up", description: "We'll let you know as soon as it's ready." }
    ]
  },
  "cutting-boards": {
    ctaNoun: "your cutting board",
    whatYouGet: [
      { title: "Quality wood", description: "Selected specifically for cutting-board use; the exact species can vary by design." },
      { title: "A functional piece and a keepsake", description: "Built for everyday use or as a gift." },
      { title: "Personalization options", description: "Names, dates, or a short message, depending on the design." },
      { title: "Easy-care construction", description: "Hand-wash and dry — built to last with simple care." }
    ],
    makeItYours: [
      { title: "Names & Dates", description: "A personalized touch for weddings, anniversaries, and gifts." },
      { title: "A Short Message", description: "Add a meaningful word or phrase." },
      { title: "Gift-Ready", description: "A popular choice for weddings, housewarmings, and birthdays." },
      { title: "Your Own Design Idea", description: "Tell us what you have in mind." }
    ],
    howItWorksHeading: "How Your Custom Cutting Board Comes Together",
    howItWorks: [
      { title: "Tell Us What You Want", description: "Share your size, wood preference, and any personalization." },
      { title: "We Work Out the Details", description: "We'll go over design and personalization before anything gets built." },
      { title: "We Build It", description: "Every board is built and finished by hand." },
      { title: "Pick It Up", description: "We'll let you know as soon as it's ready." }
    ]
  }
};

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

  // Same gallery_photos + OurWorkSection already used on the homepage —
  // reused unmodified on every product page now, not just one.
  const { data: galleryPhotos } = await supabase.from("gallery_photos").select("*").order("sort_order", { ascending: true });

  const landing = PRODUCT_LANDING_CONTENT[params.slug as ProductKey];
  const isCornhole = params.slug === "cornhole-boards";
  const isPlanter = params.slug === "planter-boxes";

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
        // Small, compact block — deliberately not a full py-14/py-20
        // section like the others, since this is meant to read as a
        // quick spec-sheet + order-contents reference, not another
        // full marketing section. Every fact here is one already
        // confirmed elsewhere on the site (product description, the
        // real published cornhole FAQs) — no measurements, hardware,
        // or finish details are stated because none are confirmed
        // anywhere in the existing data.
        <section className="max-w-4xl mx-auto px-6 pb-14">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="bg-white border border-walnut/10 rounded-xl p-5">
              <h2 className="font-display text-lg text-walnut mb-3">Board Specifications</h2>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-walnut/60">Size</dt>
                  <dd className="text-walnut font-medium text-right">Regulation size</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-walnut/60">Material</dt>
                  <dd className="text-walnut font-medium text-right">Baltic birch plywood (tops &amp; frames)</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-walnut/60">Graphics</dt>
                  <dd className="text-walnut font-medium text-right">UV-printed (not vinyl)</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-walnut/60">Construction</dt>
                  <dd className="text-walnut font-medium text-right">Built by hand</dd>
                </div>
              </dl>
            </div>
            <div className="bg-white border border-walnut/10 rounded-xl p-5">
              <h2 className="font-display text-lg text-walnut mb-3">What's Included</h2>
              <ul className="space-y-2 text-sm">
                <li className="flex gap-2">
                  <span className="flex-shrink-0 w-2 h-2 rounded-full bg-ember mt-1.5" aria-hidden="true" />
                  <span className="text-walnut/70">Your custom-built cornhole board set, built to your design</span>
                </li>
                <li className="flex gap-2">
                  <span className="flex-shrink-0 w-2 h-2 rounded-full bg-ember mt-1.5" aria-hidden="true" />
                  <span className="text-walnut/70">A design proof to review and approve before we print</span>
                </li>
              </ul>
            </div>
          </div>
        </section>
      )}

      {isPlanter && (
        // Named "Sizing" rather than "Available Sizes" deliberately —
        // there is no fixed size chart anywhere in the site's data.
        // Every planter FAQ confirms the opposite: dimensions are
        // fully custom to the space the customer provides. This
        // section states that plainly, plus the one confirmed depth
        // detail, rather than implying a menu of preset options that
        // doesn't exist. Same compact-card treatment as Cornhole's
        // spec block above, reused for visual consistency rather than
        // inventing a new pattern.
        <section className="max-w-4xl mx-auto px-6 pb-14">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="bg-white border border-walnut/10 rounded-xl p-5">
              <h2 className="font-display text-lg text-walnut mb-2">Custom Dimensions</h2>
              <p className="text-sm text-walnut/70">
                There's no fixed size chart — every planter is built to the space you give us. Include your dimensions when requesting a quote.
              </p>
            </div>
            <div className="bg-white border border-walnut/10 rounded-xl p-5">
              <h2 className="font-display text-lg text-walnut mb-2">Planting Depth</h2>
              <p className="text-sm text-walnut/70">
                Designed with practical planting depth, while leaving room for the structure and drainage. Exact depth can vary by design.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* What You Get — sourced from this product's own confirmed FAQ
          answers and description; content differs per product via the
          PRODUCT_LANDING_CONTENT lookup above, nothing fabricated. */}
      <section className="max-w-4xl mx-auto px-6 py-14 md:py-20 border-t border-walnut/10">
        <h2 className="font-display text-2xl md:text-3xl text-walnut text-center mb-10">What You Get</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-8">
          {landing.whatYouGet.map(item => (
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

      {/* Make It Yours — the real customization options already stated
          for this specific product, not a generic list reused across
          all four. */}
      <section className="bg-sawdust/60 px-6 py-14 md:py-20">
        <div className="max-w-4xl mx-auto">
          <h2 className="font-display text-2xl md:text-3xl text-walnut text-center mb-10">Make It Yours</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {landing.makeItYours.map(item => (
              <div key={item.title} className="bg-white border border-walnut/10 rounded-xl p-5 text-center">
                <h3 className="font-display text-base text-walnut mb-1.5">{item.title}</h3>
                <p className="text-sm text-walnut/60">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it comes together — mirrors the exact visual pattern
          already used for the homepage's "How It Works" section
          (numbered ember circles). Cornhole's steps mention a design
          proof because cornhole orders genuinely go through that
          stage (see statusSteps.ts: CORNHOLE_STEPS); the other three
          use STANDARD_STEPS instead, so their copy correctly describes
          the plain order → build → pickup flow, not a proof step. */}
      <section className="max-w-4xl mx-auto px-6 py-14 md:py-20">
        <h2 className="font-display text-2xl md:text-3xl text-walnut text-center mb-10">{landing.howItWorksHeading}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {landing.howItWorks.map((step, i) => (
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

      {/* Reuses the exact same OurWorkSection + gallery_photos already
          used on the homepage — same photos, same placeholder-when-empty
          behavior, same auto-update the moment real photos are uploaded
          via the admin gallery. Not filtered per product, since
          gallery_photos has no per-product tagging today — every
          product page shows the same site-wide gallery. */}
      <OurWorkSection photos={galleryPhotos || []} />

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

      <section className="px-6 py-14 md:py-20 text-center bg-walnut">
        <h2 className="font-display text-2xl md:text-3xl text-cream mb-3">Have an idea for {landing.ctaNoun}? Let's build it.</h2>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-xs sm:max-w-none mx-auto mb-4">
          <TrackedLink
            href={`/request-quote?type=${PRODUCT_KEY_TO_ORDER_TYPE[params.slug as ProductKey]}`}
            className="w-full sm:w-auto text-center inline-block bg-ember text-white px-7 py-3.5 rounded-md font-semibold hover:opacity-90 transition-opacity"
            eventName="request_quote_click"
            eventParams={{ location: "product_page_closing_cta", category: params.slug }}
          >
            Request a Custom Quote
          </TrackedLink>
          <TrackedLink
            href={`tel:${content.contact.phone.replace(/\D/g, "")}`}
            className="w-full sm:w-auto text-center inline-block border border-cream text-cream px-7 py-3.5 rounded-md font-semibold hover:bg-white/10 transition-colors"
            eventName="phone_click"
            eventParams={{ location: "product_page_closing_cta", category: params.slug }}
          >
            Call: {content.contact.phone}
          </TrackedLink>
        </div>
        <p className="text-sm text-cream/60">📍 Local pickup only — Lawrence, MI</p>
      </section>
      <SiteFooter />
      <GuestChatWidget />
    </div>
  );
}
