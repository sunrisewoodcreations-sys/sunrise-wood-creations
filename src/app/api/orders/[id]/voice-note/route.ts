import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Appends transcribed speech to the order's existing production_notes
// field — the exact same field Production Schedule cards already
// read and display, not a new notes concept.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: adminProfile } = await supabase.from("profiles").select("role").eq("id", user?.id).single();
  if (adminProfile?.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { text } = await req.json();
  if (!text?.trim()) return NextResponse.json({ error: "No text provided" }, { status: 400 });

  const admin = createAdminClient();
  const { data: order } = await admin.from("orders").select("production_notes").eq("id", params.id).maybeSingle();
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const stamp = new Date().toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  const newEntry = `[${stamp}] ${text.trim()}`;
  const updatedNotes = order.production_notes ? `${order.production_notes}\n${newEntry}` : newEntry;

  const { error } = await admin.from("orders").update({ production_notes: updatedNotes }).eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true, production_notes: updatedNotes });
}
