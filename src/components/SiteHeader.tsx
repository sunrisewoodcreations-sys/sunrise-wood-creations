import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_SITE_CONTENT, SiteContent, PRODUCT_ORDER } from "@/lib/siteContent";
import AccountMenu from "@/components/AccountMenu";

// Same header as the homepage, pulled into one shared component so the
// public site and account pages always match — no copy-pasting the nav
// or login logic into every page.
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
        <AccountMenu role={role} name={fullName} />
      ) : (
        <Link href="/login" className="bg-walnut text-cream px-4 py-2 rounded-md text-sm font-semibold">
          Login
        </Link>
      )}
    </header>
  );
}
