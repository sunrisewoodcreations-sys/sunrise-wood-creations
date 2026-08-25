import { createClient } from "@/lib/supabase/server";
import { DEFAULT_SITE_CONTENT, SiteContent } from "@/lib/siteContent";
import WebsiteStatusToggle from "@/components/WebsiteStatusToggle";

export const dynamic = "force-dynamic";

export default async function WebsiteStatusPage() {
  const supabase = createClient();
  const { data: settingsRow } = await supabase.from("site_settings").select("data").eq("id", 1).maybeSingle();
  const content = (settingsRow?.data as SiteContent) || DEFAULT_SITE_CONTENT;
  const currentStatus = content.websiteStatus || "live";

  return (
    <div>
      <h1 className="font-display text-2xl text-[#1E3A5F] mb-1">Website Status</h1>
      <p className="text-sm text-[#1E3A5F]/60 mb-6">
        Control whether visitors see the real website or a Coming Soon page. You'll always be able to view and test the real site while logged in as admin, regardless of this setting.
      </p>
      <WebsiteStatusToggle initialStatus={currentStatus} />
    </div>
  );
}
