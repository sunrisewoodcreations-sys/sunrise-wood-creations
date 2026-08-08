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
      <div className="opacity-80 mt-1">{content.contact.phone} · {content.contact.email}</div>
    </footer>
  );
}
