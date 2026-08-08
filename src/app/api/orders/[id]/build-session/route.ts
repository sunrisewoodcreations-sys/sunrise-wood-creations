import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// One route handling start/pause/resume/finish, since all four are
// just different transitions on the same session row rather than
// separate concepts. `action` picks which transition to apply.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: adminProfile } = await supabase.from("profiles").select("role").eq("id", user?.id).single();
  if (adminProfile?.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { action } = await req.json();
  const admin = createAdminClient();

  if (action === "start") {
    const { data: session, error } = await admin.from("order_build_sessions").insert({ order_id: params.id }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, session });
  }

  const { data: existing } = await admin
    .from("order_build_sessions")
    .select("*")
    .eq("order_id", params.id)
    .in("status", ["running", "paused"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!existing) return NextResponse.json({ error: "No active timer for this order." }, { status: 400 });

  const now = new Date();

  if (action === "pause") {
    const elapsedSinceStart = existing.status === "running"
      ? existing.elapsed_seconds + Math.round((now.getTime() - new Date(existing.resumed_at || existing.started_at).getTime()) / 1000)
      : existing.elapsed_seconds;
    const { error } = await admin.from("order_build_sessions").update({
      status: "paused", paused_at: now.toISOString(), elapsed_seconds: elapsedSinceStart
    }).eq("id", existing.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  if (action === "resume") {
    const { error } = await admin.from("order_build_sessions").update({
      status: "running", resumed_at: now.toISOString()
    }).eq("id", existing.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  if (action === "finish") {
    const elapsedSinceStart = existing.status === "running"
      ? existing.elapsed_seconds + Math.round((now.getTime() - new Date(existing.resumed_at || existing.started_at).getTime()) / 1000)
      : existing.elapsed_seconds;
    const { error } = await admin.from("order_build_sessions").update({
      status: "finished", finished_at: now.toISOString(), elapsed_seconds: elapsedSinceStart
    }).eq("id", existing.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
