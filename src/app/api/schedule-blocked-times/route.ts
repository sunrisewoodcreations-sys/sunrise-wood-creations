import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function requireAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user?.id).single();
  return profile?.role === "admin";
}

// Blocks part of a day (an appointment, running errands, really busy) so
// no pickups or deliveries can be booked then. Whole days off still use
// the existing blocked dates; this is for time ranges. Pass allDay: true
// to block the whole business day.
export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const date = typeof body.date === "string" ? body.date : "";
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 200) : null;
  const startTime = body.allDay ? "00:00" : String(body.startTime || "");
  const endTime = body.allDay ? "23:59" : String(body.endTime || "");

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: "Pick a date." }, { status: 400 });
  if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime)) return NextResponse.json({ error: "Pick a start and end time." }, { status: 400 });
  if (endTime <= startTime) return NextResponse.json({ error: "The end time must be after the start time." }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin.from("schedule_blocked_times")
    .insert({ blocked_date: date, start_time: startTime, end_time: endTime, reason: reason || null })
    .select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Heads-up only (never cancels anything): appointments already booked in
  // the blocked range, so you can move them.
  const { data: clashes } = await admin.from("pickup_appointments")
    .select("id").in("status", ["scheduled", "arrived"]).eq("appointment_date", date)
    .lt("block_start_at", `${date} ${endTime}:00`).gt("block_end_at", `${date} ${startTime}:00`);

  return NextResponse.json({ ok: true, blocked: data, existingAppointmentsInRange: clashes?.length || 0 });
}
