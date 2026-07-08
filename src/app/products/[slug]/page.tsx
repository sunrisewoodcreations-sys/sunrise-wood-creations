import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_SITE_CONTENT, SiteContent, ProductKey, PRODUCT_ORDER } from "@/lib/siteContent";
import AccountMenu from "@/components/AccountMenu";

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

  const visibleProducts = PRODUCT_ORDER
    .map(key => ({ slug: key, ...content.products[key] }))
    .filter(p => p.enabled);

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let role: "admin" | "customer" | null = null;
  if (user) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    role = (profile?.role as "admin" | "customer") || "customer";
  }

  return (
    <div>
      <header className="flex items-center justify-between px-6 md:px-10 py-4 border-b border-walnut/10 bg-cream">
        <Link href="/" className="font-display text-lg md:text-xl text-walnut font-semibold">Sunrise Wood Creations</Link>
        <nav className="hidden md:flex gap-7 text-sm font-medium">
          {visibleProducts.map(p => (
            <Link key={p.slug} href={`/products/${p.slug}`} className="text-walnut/80 hover:text-walnut">
              {p.name}
            </Link>
          ))}
        </nav>
        {role ? (
          <AccountMenu role={role} />
        ) : (
          <Link href="/login" className="bg-walnut text-cream px-4 py-2 rounded-md text-sm font-semibold">Login</Link>
        )}
      </header>

      <section className="max-w-2xl mx-auto px-6 py-16">
        <Link href="/" className="text-sm text-walnut/60 mb-4 inline-block">← All products</Link>
        <h1 className="font-display text-3xl md:text-4xl text-walnut mb-2">{product.name}</h1>
        <p className="text-lg text-ember font-medium mb-6">{product.tagline}</p>
        <p className="text-walnut/70 mb-8 leading-relaxed">{product.description}</p>

        <a href={`tel:${content.contact.phone.replace(/\D/g, "")}`} className="inline-block bg-ember text-white px-7 py-3.5 rounded-md font-semibold">
          Call to get a quote: {content.contact.phone}
        </a>
      </section>

      <footer className="bg-walnut text-cream text-center py-9 px-6 text-sm">
        <div>Sunrise Wood Creations</div>
        <div className="opacity-80 mt-1">{content.contact.phone} · {content.contact.email}</div>
      </footer>
    </div>
  );
}
