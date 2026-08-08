import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAvailabilitySettings } from "@/lib/pickupScheduling";

export async function PATCH(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: adminProfile } = await supabase.from("profiles").select("role").eq("id", user?.id).single();
  if (adminProfile?.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const body = await req.json();
  const settings = await getAvailabilitySettings(); // ensures a row exists
  const admin = createAdminClient();

  const updatePayload: Record<string, any> = { updated_at: new Date().toISOString() };
  if (body.businessAddress !== undefined) updatePayload.business_address = body.businessAddress;
  if (body.contactPhone !== undefined) updatePayload.contact_phone = body.contactPhone;
  if (body.pickupInstructions !== undefined) updatePayload.pickup_instructions = body.pickupInstructions;
  if (Array.isArray(body.availableDays)) updatePayload.available_days = body.availableDays.map(Number);
  if (body.startTime) updatePayload.start_time = body.startTime;
  if (body.endTime) updatePayload.end_time = body.endTime;
  if (body.slotLengthMinutes) updatePayload.slot_length_minutes = Math.max(5, Math.round(Number(body.slotLengthMinutes)));
  if (body.maxPickupsPerSlot) updatePayload.max_pickups_per_slot = Math.max(1, Math.round(Number(body.maxPickupsPerSlot)));
  if (body.send2hourReminder !== undefined) updatePayload.send_2hour_reminder = !!body.send2hourReminder;
  if (body.vacationModeEnabled !== undefined) updatePayload.vacation_mode_enabled = !!body.vacationModeEnabled;
  if (body.vacationReturnDate !== undefined) updatePayload.vacation_return_date = body.vacationReturnDate || null;

  const { error } = await admin.from("pickup_availability_settings").update(updatePayload).eq("id", settings.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
