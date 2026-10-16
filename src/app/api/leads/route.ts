import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cleanLeadFields } from "@/lib/leads";

// Adds a lead (someone who messaged you). Admin only.
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("role, is_demo_account").eq("id", user?.id).single();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const cleaned = cleanLeadFields(body, { requireName: true });
  if (!cleaned.ok) {
    return NextResponse.json({ error: cleaned.error }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("leads")
    .insert({ ...cleaned.fields, is_demo: !!profile?.is_demo_account })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true, lead: data });
}
