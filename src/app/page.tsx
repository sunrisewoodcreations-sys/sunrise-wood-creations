import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_SITE_CONTENT, SiteContent, PRODUCT_ORDER } from "@/lib/siteContent";
import AccountMenu from "@/components/AccountMenu";

export const metadata: Metadata = {
  title: "Custom cornhole boards, wooden signs, planters & cutting boards",
  description:
    "Sunrise Wood Creations builds handcrafted, made-to-order cornhole boards, wooden signs, planter boxes, and cutting boards in Michigan. Request a custom order today."
};

export default async function HomePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let role: "admin" | "customer" | null = null;
  if (user) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    role = (profile?.role as "admin" | "customer") || "customer";
  }

  const { data: settingsRow } = await supabase.from("site_settings").select("data").eq("id", 1).single();
  const content: SiteContent = (settingsRow?.data as SiteContent) || DEFAULT_SITE_CONTENT;

  const visibleProducts = PRODUCT_ORDER
    .map(key => ({ slug: key, ...content.products[key] }))
    .filter(p => p.enabled);

  return (
    <div>
      <header className="flex items-center justify-between px-6 md:px-10 py-4 border-b border-walnut/10 bg-cream">
        <Link href="/" className="font-display text-lg md:text-xl text-walnut font-semibold">
          Sunrise Wood Creations
        </Link>
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
          <Link href="/login" className="bg-walnut text-cream px-4 py-2 rounded-md text-sm font-semibold">
            Login
          </Link>
        )}
      </header>

      <section className="text-center px-6 py-16 md:py-24 bg-gradient-to-b from-amber/10 to-cream">
        <h1 className="font-display text-4xl md:text-5xl text-walnut font-semibold mb-4 whitespace-pre-line">
          {content.hero.heading}
        </h1>
        <p className="text-walnut/70 max-w-lg mx-auto mb-7">
          {content.hero.subheading}
        </p>
        <a href={`tel:${content.contact.phone.replace(/\D/g, "")}`} className="inline-block bg-ember text-white px-7 py-3.5 rounded-md font-semibold">
          {content.hero.ctaText}
        </a>
      </section>

      <section className="max-w-5xl mx-auto px-6 py-14 md:py-20">
        <h2 className="font-display text-2xl md:text-3xl text-walnut text-center mb-2">What we build</h2>
        <p className="text-center text-walnut/60 mb-10">Every piece is made to order.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {visibleProducts.map(p => (
            <Link
              key={p.slug}
              href={`/products/${p.slug}`}
              className="bg-sawdust border border-walnut/10 rounded-xl p-6 hover:-translate-y-1 transition-transform"
            >
              <h3 className="font-display text-lg text-walnut mb-2">{p.name}</h3>
              <p className="text-sm text-walnut/60 mb-3">{p.shortDesc}</p>
              <span className="text-ember text-sm font-semibold">View options →</span>
            </Link>
          ))}
        </div>
      </section>

      <footer className="bg-walnut text-cream text-center py-9 px-6 text-sm">
        <div>Sunrise Wood Creations</div>
        <div className="opacity-80 mt-1">{content.contact.phone} · {content.contact.email}</div>
      </footer>
    </div>
  );
}
