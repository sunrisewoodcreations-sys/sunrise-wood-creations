import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Persists a manual drag-and-drop reorder — once an admin drags any
// order in the queue, every order currently visible gets a sequential
// manual_queue_position matching the new visual order, so the whole
// arrangement reflects the manual choice rather than a mix of pinned
// and auto-sorted items in unpredictable places.
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: adminProfile } = await supabase.from("profiles").select("role").eq("id", user?.id).single();
  if (adminProfile?.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { orderedIds, clearAll } = await req.json();
  const admin = createAdminClient();

  if (clearAll) {
    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      return NextResponse.json({ error: "orderedIds is required" }, { status: 400 });
    }
    const { error } = await admin.from("orders").update({ manual_queue_position: null }).in("id", orderedIds);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    return NextResponse.json({ error: "orderedIds is required" }, { status: 400 });
  }
  const results = await Promise.all(
    orderedIds.map((id: string, index: number) => admin.from("orders").update({ manual_queue_position: index + 1 }).eq("id", id))
  );
  const failed = results.find((r: any) => r.error);
  if (failed) return NextResponse.json({ error: failed.error?.message || "Couldn't save the new order" }, { status: 400 });

  return NextResponse.json({ ok: true });
}
