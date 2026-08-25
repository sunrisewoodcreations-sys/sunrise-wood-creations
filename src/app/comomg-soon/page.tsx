import Image from "next/image";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_SITE_CONTENT, SiteContent } from "@/lib/siteContent";

// Never indexed while this page is what visitors see — there's
// nothing here worth ranking, and it would be confusing for a search
// result to point at a page that disappears the moment the real site
// goes live.
export const metadata: Metadata = {
  title: "Sunrise Wood Creations — Coming Soon",
  robots: { index: false, follow: false }
};

export default async function ComingSoonPage() {
  const supabase = createClient();
  const { data: settingsRow } = await supabase.from("site_settings").select("data").eq("id", 1).maybeSingle();
  const content = (settingsRow?.data as SiteContent) || DEFAULT_SITE_CONTENT;
  const contact = { ...DEFAULT_SITE_CONTENT.contact, ...content.contact };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-amber/10 to-cream px-6 text-center">
      <Image
        src="/logo-full.png"
        alt="Sunrise Wood Creations"
        width={1000}
        height={1000}
        priority
        className="w-40 sm:w-56 h-auto mx-auto mb-6"
      />
      <h1 className="font-display text-3xl sm:text-4xl text-walnut font-semibold mb-3">
        Coming Soon
      </h1>
      <p className="text-walnut/70 max-w-md mx-auto mb-8 text-[15px] sm:text-base">
        We're working on our new website and can't wait to show you what we've been creating.
      </p>
      <div className="text-sm text-walnut/50 flex flex-col sm:flex-row items-center gap-1.5 sm:gap-3">
        <a href={`tel:${contact.phone.replace(/\D/g, "")}`} className="hover:text-walnut transition-colors">
          {contact.phone}
        </a>
        <span className="hidden sm:inline" aria-hidden="true">·</span>
        <a href={`mailto:${contact.email}`} className="hover:text-walnut transition-colors">
          {contact.email}
        </a>
      </div>
    </div>
  );
}
