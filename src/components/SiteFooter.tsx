import { createClient } from "@/lib/supabase/server";
import { DEFAULT_SITE_CONTENT, SiteContent } from "@/lib/siteContent";

// Same footer as the homepage, shared so it stays in sync everywhere.
export default async function SiteFooter() {
  const supabase = createClient();
  const { data: settingsRow } = await supabase.from("site_settings").select("data").eq("id", 1).single();
  const content: SiteContent = (settingsRow?.data as SiteContent) || DEFAULT_SITE_CONTENT;

  return (
    <footer className="bg-walnut text-cream text-center py-9 px-6 text-sm">
      <div>Sunrise Wood Creations</div>
      <div className="opacity-80 mt-1.5 flex items-center justify-center gap-2 flex-wrap">
        <a href={`tel:${content.contact.phone.replace(/\D/g, "")}`} className="hover:text-cream hover:opacity-100 transition-opacity">
          {content.contact.phone}
        </a>
        <span aria-hidden="true">·</span>
        <a href={`mailto:${content.contact.email}`} className="hover:text-cream hover:opacity-100 transition-opacity">
          {content.contact.email}
        </a>
      </div>
    </footer>
  );
}
