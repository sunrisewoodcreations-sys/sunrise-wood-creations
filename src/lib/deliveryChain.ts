import { createAdminClient } from "@/lib/supabase/admin";
import { drivingDurationMinutes, MapsError } from "@/lib/googleMaps";
import { resolveAndStoreDeliveryAddress } from "@/lib/deliveryAddress";
import { absMinute, absToDateTime, absToTimestamp, chainedStop } from "@/lib/scheduleCore";

export type ChainResult =
  | { ok: true; appointmentId: string; arrivalDate: string; arrivalTime: string }
  | { ok: false; error: string; needsConfirmation?: boolean; suggestedAddress?: string; reason?: string };

// "I'll drop another one on my way home": adds a second delivery stop right
// after an existing one. The first delivery's block now ends when you leave
// it (no drive home), and the new stop starts right then: drive A -> B,
// 15 min there, drive B -> home, 15 min buffer. Your admin override of the
// normal "drive home in between" rule.
export async function addStopOnWayHome(opts: {
  firstAppointmentId: string;
  secondOrderId: string;
  secondAddress?: string;
  confirmAddress?: boolean;
}): Promise<ChainResult> {
  const admin = createAdminClient();

  const { data: a } = await admin
    .from("pickup_appointments")
    .select("id, appointment_date, appointment_time, appointment_type, status, block_start_at, block_end_at, orders:order_id(delivery_address)")
    .eq("id", opts.firstAppointmentId).maybeSingle();
  if (!a || a.appointment_type !== "delivery" || !["scheduled", "arrived"].includes(a.status)) {
    return { ok: false, error: "That isn't an active delivery." };
  }
  const aAddress = (a as any).orders?.delivery_address as string | null;
  if (!aAddress) return { ok: false, error: "The first delivery has no address on file." };

  const { data: bOrder } = await admin.from("orders")
    .select("id, fulfillment_method, delivery_address, delivery_drive_minutes").eq("id", opts.secondOrderId).maybeSingle();
  if (!bOrder || bOrder.fulfillment_method !== "delivery") return { ok: false, error: "The second order isn't a delivery order." };

  const { count: activeForB } = await admin.from("pickup_appointments")
    .select("id", { count: "exact", head: true })
    .eq("order_id", bOrder.id).in("status", ["scheduled", "arrived"]);
  if ((activeForB || 0) > 0) return { ok: false, error: "That order already has a scheduled delivery. Reschedule or cancel it first." };

  const addressToUse = (opts.secondAddress && opts.secondAddress.trim()) || (bOrder.delivery_drive_minutes > 0 ? "" : bOrder.delivery_address || "");
  if (addressToUse) {
    const r = await resolveAndStoreDeliveryAddress(bOrder.id, addressToUse, opts.confirmAddress === true);
    if (!r.ok) {
      if (r.needsConfirmation) return { ok: false, error: r.error, needsConfirmation: true, suggestedAddress: r.suggestedAddress, reason: r.reason };
      return { ok: false, error: r.error };
    }
  }
  const { data: b } = await admin.from("orders").select("delivery_address, delivery_drive_minutes").eq("id", bOrder.id).single();
  if (!b?.delivery_address || !(b.delivery_drive_minutes > 0)) {
    return { ok: false, error: "Enter the second delivery address first." };
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return { ok: false, error: "Google Maps isn't connected yet." };
  let driveAtoB: number;
  try {
    driveAtoB = await drivingDurationMinutes(aAddress, b.delivery_address, apiKey);
  } catch (err) {
    return { ok: false, error: err instanceof MapsError ? err.message : "Couldn't work out the drive between the two stops." };
  }

  const { data: ds } = await admin.from("delivery_settings").select("minutes_at_customer, buffer_after_minutes").eq("id", 1).maybeSingle();
  const minutesAtCustomer = ds?.minutes_at_customer ?? 15;
  const bufferAfterMinutes = ds?.buffer_after_minutes ?? 15;

  const aArrival = absMinute(a.appointment_date, String(a.appointment_time).slice(0, 5));
  const chain = chainedStop({ aArrival, minutesAtCustomer, driveAtoB, driveBHome: b.delivery_drive_minutes, bufferAfterMinutes });
  const arrival = absToDateTime(chain.bArrival);

  // 1) Shrink the first delivery so it ends when you leave it.
  const originalEnd = a.block_end_at;
  const { error: shrinkErr } = await admin.from("pickup_appointments").update({ block_end_at: absToTimestamp(chain.aEnd) }).eq("id", a.id);
  if (shrinkErr) return { ok: false, error: shrinkErr.message };

  // 2) Insert the second stop. The database refuses it if it runs into
  // anything else on your schedule; in that case the first is put back.
  const { data: inserted, error: insErr } = await admin.from("pickup_appointments").insert({
    order_id: bOrder.id,
    appointment_date: arrival.dateStr,
    appointment_time: arrival.time,
    source: "admin_manual",
    appointment_type: "delivery",
    block_start_at: absToTimestamp(chain.bBlock.start),
    block_end_at: absToTimestamp(chain.bBlock.end),
    follows_appointment_id: a.id
  }).select("id").single();

  if (insErr || !inserted) {
    await admin.from("pickup_appointments").update({ block_end_at: originalEnd }).eq("id", a.id);
    if (insErr?.code === "23P01") return { ok: false, error: "That second stop runs into another appointment on your schedule." };
    return { ok: false, error: insErr?.message || "Couldn't add the second stop." };
  }

  return { ok: true, appointmentId: inserted.id, arrivalDate: arrival.dateStr, arrivalTime: arrival.time };
}
