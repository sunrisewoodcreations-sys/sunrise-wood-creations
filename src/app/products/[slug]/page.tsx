import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_SITE_CONTENT, SiteContent, ProductKey, PRODUCT_ORDER, PRODUCT_KEY_TO_ORDER_TYPE } from "@/lib/siteContent";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import GuestChatWidget from "@/components/GuestChatWidget";
import TrackedLink from "@/components/TrackedLink";
import ProductImage from "@/components/ProductImage";
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
      <section className="max-w-4xl mx-auto px-6 py-16">
        <Link href="/" className="text-sm text-walnut/60 mb-4 inline-block">← All products</Link>
        <ProductImage
          imageUrl={product.imageUrl}
          name={product.name}
          areaClassName="aspect-[4/3] rounded-xl overflow-hidden mb-6"
          iconSize={32}
        />
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

        <div className="mt-14">
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
        </div>
      </section>
      <SiteFooter />
      <GuestChatWidget />
    </div>
  );
}
