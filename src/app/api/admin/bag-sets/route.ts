import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_SITE_CONTENT, SiteContent } from "@/lib/siteContent";
import { normalizeBagSets } from "@/lib/bagSets";

async function requireAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: p } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  return p?.role === "admin";
}

export async function PUT(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const bagSets = normalizeBagSets(body?.bagSets);

  const admin = createAdminClient();
  const { data: row } = await admin.from("site_settings").select("data").eq("id", 1).maybeSingle();
  const current: SiteContent = (row?.data as SiteContent) || DEFAULT_SITE_CONTENT;
  const { error } = await admin.from("site_settings").upsert({ id: 1, data: { ...current, bagSets } });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, bagSets });
}
