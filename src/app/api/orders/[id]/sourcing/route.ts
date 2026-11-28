import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const VALID = ["not_ordered", "ordered", "shipped", "received"];

// Admin-only tracking of outsourced cornhole tops and frames. Never
// touches the customer-facing status and never sends an email.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: adminProfile } = await supabase.from("profiles").select("role").eq("id", user?.id).single();
  if (adminProfile?.role !== "admin") return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const body = await req.json();
  const update: Record<string, any> = {};
  const now = new Date().toISOString();
  if ("tops" in body) {
    if (!VALID.includes(body.tops)) return NextResponse.json({ error: "Invalid tops status" }, { status: 400 });
    update.tops_status = body.tops;
    update.tops_status_at = body.tops === "not_ordered" ? null : now;
  }
  if ("frames" in body) {
    if (!VALID.includes(body.frames)) return NextResponse.json({ error: "Invalid frames status" }, { status: 400 });
    update.frames_status = body.frames;
    update.frames_status_at = body.frames === "not_ordered" ? null : now;
  }
  if (Object.keys(update).length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  const { error } = await supabase.from("orders").update(update).eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
