import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cleanLeadFields } from "@/lib/leads";

// Looks up the logged-in admin and the lead, and refuses if either is
// wrong. A demo account only ever sees and changes demo leads, and a real
// account only real ones, same separation as orders and customers.
async function authorize(leadId: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("role, is_demo_account").eq("id", user?.id).single();
  if (profile?.role !== "admin") {
    return { error: NextResponse.json({ error: "Not authorized" }, { status: 403 }) };
  }
  const admin = createAdminClient();
  const { data: lead } = await admin.from("leads").select("id, is_demo").eq("id", leadId).maybeSingle();
  if (!lead || lead.is_demo !== !!profile?.is_demo_account) {
    return { error: NextResponse.json({ error: "Lead not found" }, { status: 404 }) };
  }
  return { admin };
}

// Edit a lead: name, phone, source, status, or notes. Only the fields
// that are sent are changed.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authorize(params.id);
  if (auth.error) return auth.error;

  const body = await req.json().catch(() => ({}));
  const cleaned = cleanLeadFields(body, { requireName: false });
  if (!cleaned.ok) {
    return NextResponse.json({ error: cleaned.error }, { status: 400 });
  }
  if (Object.keys(cleaned.fields).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { error } = await auth.admin!.from("leads").update(cleaned.fields).eq("id", params.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

// Remove a lead from the list. Never touches a customer or order the
// lead was turned into.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authorize(params.id);
  if (auth.error) return auth.error;

  const { error } = await auth.admin!.from("leads").delete().eq("id", params.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
