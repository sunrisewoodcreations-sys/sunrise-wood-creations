import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: adminProfile } = await supabase.from("profiles").select("role").eq("id", user?.id).single();

  if (adminProfile?.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { name, boardLength, kerf, resultJson } = await req.json();
  if (!name?.trim() || !resultJson) {
    return NextResponse.json({ error: "Missing name or result data" }, { status: 400 });
  }

  // Auto-saved pending plans: don't create a duplicate if the same plan
  // (same name and same products/quantities) is still waiting.
  const inv = resultJson?.inventory;
  if (inv?.status === "pending") {
    const { data: existing } = await supabase.from("saved_cut_lists").select("result_json").eq("name", name.trim());
    const sig = JSON.stringify((inv.items || []).map((i: any) => [i.productId, i.quantity]));
    const dup = (existing || []).some((e: any) =>
      e.result_json?.inventory?.status === "pending" &&
      JSON.stringify((e.result_json.inventory.items || []).map((i: any) => [i.productId, i.quantity])) === sig);
    if (dup) return NextResponse.json({ ok: true, duplicate: true });
  }

  const { error } = await supabase.from("saved_cut_lists").insert({
    name: name.trim(),
    board_length: boardLength,
    kerf,
    result_json: resultJson
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
