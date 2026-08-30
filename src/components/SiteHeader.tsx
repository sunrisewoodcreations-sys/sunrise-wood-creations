import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_SITE_CONTENT, SiteContent, PRODUCT_ORDER } from "@/lib/siteContent";
import AccountMenu from "@/components/AccountMenu";
import MobileNavToggle from "@/components/MobileNavToggle";
import ProductsDropdown from "@/components/ProductsDropdown";
import TrackedLink from "@/components/TrackedLink";

// Same header as the homepage, pulled into one shared component so the
// public site and account pages always match — no copy-pasting the nav
// or login logic into every page.
//
// Gallery / About Us / FAQ / Contact don't exist as separate pages —
// their content already lives on the homepage (Our Work, Why Us, the
// FAQ section) and in the footer (contact info). Rather than build
// duplicate pages, these link to those existing sections via anchors,
// the same way the hero's own "View Our Work" link already does for
// #products.
const SECONDARY_LINKS = [
  { href: "/#gallery", label: "Gallery" },
  { href: "/#about", label: "About Us" },
  { href: "/#faq", label: "FAQ" },
  { href: "/#contact", label: "Contact" }
];

export default async function SiteHeader() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let role: "admin" | "customer" | null = null;
  let fullName: string | undefined;
  if (user) {
    const { data: profile } = await supabase.from("profiles").select("role, full_name").eq("id", user.id).single();
    role = (profile?.role as "admin" | "customer") || "customer";
    fullName = profile?.full_name;
  }

  const { data: settingsRow } = await supabase.from("site_settings").select("data").eq("id", 1).single();
  const content: SiteContent = (settingsRow?.data as SiteContent) || DEFAULT_SITE_CONTENT;
  const visibleProducts = PRODUCT_ORDER
    .map(key => ({ slug: key, ...content.products[key] }))
    .filter(p => p.enabled);

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between px-6 md:px-10 py-4 border-b border-walnut/10 bg-cream shadow-sm">
      <Link href="/" className="flex-shrink-0">
        <Image
          src="/logo-header.png"
          alt="Sunrise Wood Creations"
          width={900}
          height={455}
          priority
          className="h-12 md:h-16 w-auto"
        />
      </Link>

      {/* Full nav only from lg: up — with 6 items plus a dropdown and a
          CTA, this needed more room than the old 4-link nav did, so
          tablet widths now use the mobile menu instead of a cramped
          inline row. */}
      <nav className="hidden lg:flex items-center gap-5 text-sm font-medium">
        <Link href="/" className="text-walnut/80 hover:text-walnut">Home</Link>
        <ProductsDropdown products={visibleProducts.map(p => ({ slug: p.slug, name: p.name }))} />
        {SECONDARY_LINKS.map(link => (
          <Link key={link.href} href={link.href} className="text-walnut/80 hover:text-walnut">
            {link.label}
          </Link>
        ))}
      </nav>

      <div className="flex items-center gap-3">
        <TrackedLink
          href="/request-quote"
          className="hidden sm:inline-block bg-ember text-white px-4 py-2 rounded-md text-sm font-semibold hover:opacity-90 transition-opacity"
          eventName="request_quote_click"
          eventParams={{ location: "header" }}
        >
          Request a Quote
        </TrackedLink>
        <MobileNavToggle
          primaryLinks={[{ href: "/", label: "Home" }]}
          products={visibleProducts.map(p => ({ slug: p.slug, name: p.name }))}
          secondaryLinks={SECONDARY_LINKS}
          ctaHref="/request-quote"
        />
        {role ? (
          <AccountMenu role={role} name={fullName} />
        ) : (
          <Link href="/login" className="bg-walnut text-cream px-4 py-2 rounded-md text-sm font-semibold">
            Login
          </Link>
        )}
      </div>
    </header>
  );
}
