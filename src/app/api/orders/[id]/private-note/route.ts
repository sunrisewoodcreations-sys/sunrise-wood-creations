import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Admin-only private note on an order. Never shown to the customer.
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: p } = await supabase.from("profiles").select("role").eq("id", user?.id).single();
  if (p?.role !== "admin") return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 2000) : "";
  const admin = createAdminClient();
  const { error } = note
    ? await admin.from("order_private_notes").upsert({ order_id: params.id, note, updated_at: new Date().toISOString() })
    : await admin.from("order_private_notes").delete().eq("order_id", params.id);
  if (error) {
    const missing = /order_private_notes/.test(error.message);
    return NextResponse.json({ error: missing ? "Private notes aren't set up in the database yet." : error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
