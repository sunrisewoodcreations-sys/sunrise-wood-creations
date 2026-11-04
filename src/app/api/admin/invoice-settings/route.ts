import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_SITE_CONTENT, SiteContent } from "@/lib/siteContent";
import { normalizeInvoiceSettings } from "@/lib/invoiceSettings";

async function requireAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: p } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  return p?.role === "admin";
}

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  const admin = createAdminClient();
  const { data } = await admin.from("site_settings").select("data").eq("id", 1).maybeSingle();
  return NextResponse.json(normalizeInvoiceSettings((data?.data as any)?.invoice));
}

// Same safe pattern as the other site_settings writers: load the whole
// current row, change only the invoice section, save the whole thing back.
export async function PUT(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  const settings = normalizeInvoiceSettings(await req.json().catch(() => ({})));

  const admin = createAdminClient();
  const { data: row } = await admin.from("site_settings").select("data").eq("id", 1).maybeSingle();
  const current: SiteContent = (row?.data as SiteContent) || DEFAULT_SITE_CONTENT;
  const { error } = await admin.from("site_settings").upsert({ id: 1, data: { ...current, invoice: settings } });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, settings });
}
