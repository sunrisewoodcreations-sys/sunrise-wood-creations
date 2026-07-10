import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_SITE_CONTENT, SiteContent, ProductKey, PRODUCT_ORDER } from "@/lib/siteContent";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import GuestChatWidget from "@/components/GuestChatWidget";

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
  return { title: product.name, description: product.description };
}

export default async function ProductPage({ params }: { params: { slug: string } }) {
  const content = await getContent();
  const product = content.products[params.slug as ProductKey];
  if (!product || !product.enabled) notFound();

  return (
    <div>
      <SiteHeader />
      <section className="max-w-2xl mx-auto px-6 py-16">
        <Link href="/" className="text-sm text-walnut/60 mb-4 inline-block">← All products</Link>
        <h1 className="font-display text-3xl md:text-4xl text-walnut mb-2">{product.name}</h1>
        <p className="text-lg text-ember font-medium mb-6">{product.tagline}</p>
        <p className="text-walnut/70 mb-8 leading-relaxed">{product.description}</p>
        <a href={`tel:${content.contact.phone.replace(/\D/g, "")}`} className="inline-block bg-ember text-white px-7 py-3.5 rounded-md font-semibold">
          Call to get a quote: {content.contact.phone}
        </a>
      </section>
      <SiteFooter />
      <GuestChatWidget />
    </div>
  );
}
