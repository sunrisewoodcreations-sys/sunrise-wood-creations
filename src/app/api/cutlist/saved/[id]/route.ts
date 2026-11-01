import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Saves how many boards have been cut (tap-to-mark progress) with the list.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: adminProfile } = await supabase.from("profiles").select("role").eq("id", user?.id).single();
  if (adminProfile?.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const raw = body?.cutProgress;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return NextResponse.json({ error: "Missing cutProgress" }, { status: 400 });
  }
  const cutProgress: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw)) {
    const n = Math.floor(Number(v));
    if (n > 0 && n < 100000 && k.length < 500) cutProgress[k] = n;
  }

  const { data: row, error: readError } = await supabase.from("saved_cut_lists").select("result_json").eq("id", params.id).maybeSingle();
  if (readError || !row) return NextResponse.json({ error: readError?.message || "Not found" }, { status: 404 });

  const { error } = await supabase
    .from("saved_cut_lists")
    .update({ result_json: { ...row.result_json, cutProgress } })
    .eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: adminProfile } = await supabase.from("profiles").select("role").eq("id", user?.id).single();

  if (adminProfile?.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { error } = await supabase.from("saved_cut_lists").delete().eq("id", params.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
