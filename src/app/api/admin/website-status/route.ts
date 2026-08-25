import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_SITE_CONTENT, SiteContent } from "@/lib/siteContent";

// Toggles Coming Soon / Live. Same careful pattern already proven for
// the carousel images route: load the FULL current site_settings row
// first, change only the one field being asked for, save the whole
// thing back — so this can never accidentally wipe the headline,
// products, Why Us section, or anything else already saved.
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: adminProfile } = await supabase.from("profiles").select("role").eq("id", user?.id).single();
  if (adminProfile?.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { status } = await req.json();
  if (status !== "coming_soon" && status !== "live") {
    return NextResponse.json({ error: "status must be 'coming_soon' or 'live'" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: settingsRow } = await admin.from("site_settings").select("data").eq("id", 1).maybeSingle();
  const currentContent: SiteContent = (settingsRow?.data as SiteContent) || DEFAULT_SITE_CONTENT;

  const updatedContent: SiteContent = { ...currentContent, websiteStatus: status };

  const { error } = await admin.from("site_settings").upsert({ id: 1, data: updatedContent });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true, status });
}
