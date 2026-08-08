import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCapacitySettings } from "@/lib/productionCapacity";

export async function PATCH(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: adminProfile } = await supabase.from("profiles").select("role").eq("id", user?.id).single();
  if (adminProfile?.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { maxHoursPerDay, bufferMinutesPerDay } = await req.json();
  const settings = await getCapacitySettings();
  const admin = createAdminClient();

  const { error } = await admin.from("production_capacity_settings").update({
    max_hours_per_day: Math.max(0, Number(maxHoursPerDay) || 0),
    buffer_minutes_per_day: Math.max(0, Math.round(Number(bufferMinutesPerDay)) || 0),
    updated_at: new Date().toISOString()
  }).eq("id", settings.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
