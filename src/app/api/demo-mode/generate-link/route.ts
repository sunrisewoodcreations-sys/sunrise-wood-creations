import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Generates a fresh, one-click login link for the demo account —
// Supabase's own magic-link mechanism, used here to produce a URL you
// copy and send to a tester however you like, rather than emailing it
// automatically to anyone. Each call produces a new link; old links
// can still be revoked instantly by disabling the demo account itself
// (see /admin/demo-mode).
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: adminProfile } = await supabase.from("profiles").select("role, is_demo_account").eq("id", user?.id).single();

  if (adminProfile?.role !== "admin" || adminProfile?.is_demo_account) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: demoProfile } = await admin.from("profiles").select("id, email").eq("is_demo_account", true).maybeSingle();
  if (!demoProfile) {
    return NextResponse.json({ error: "No demo account exists yet — set one up first." }, { status: 400 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || `https://${req.headers.get("host")}`;
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: demoProfile.email,
    options: { redirectTo: `${siteUrl}/auth/confirm?next=/admin` }
  });

  if (error || !data) return NextResponse.json({ error: error?.message || "Couldn't generate a login link." }, { status: 500 });

  return NextResponse.json({ ok: true, link: data.properties?.action_link });
}
