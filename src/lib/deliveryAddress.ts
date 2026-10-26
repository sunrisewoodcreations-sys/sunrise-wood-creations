import { createAdminClient } from "@/lib/supabase/admin";
import { geocodeAddress, drivingDurationMinutes, MapsError } from "@/lib/googleMaps";

export type ResolveResult =
  | { ok: true; address: string; driveMinutes: number }
  | { ok: false; error: string; status: number; needsConfirmation?: boolean; suggestedAddress?: string; reason?: string };

// Checks a delivery address with Google, works out the one-way drive time
// from your home, and saves both on the order. Done once per address: if
// the same address is already saved with a drive time, no Google lookup is
// made at all (that is what keeps the Google bill tiny).
export async function resolveAndStoreDeliveryAddress(orderId: string, rawAddress: string, confirmAddress = false): Promise<ResolveResult> {
  const address = rawAddress.trim();
  if (address.length < 5 || address.length > 200) {
    return { ok: false, status: 400, error: "Enter the full delivery address." };
  }

  const admin = createAdminClient();
  const { data: order } = await admin.from("orders").select("id, delivery_address, delivery_drive_minutes").eq("id", orderId).maybeSingle();
  if (!order) return { ok: false, status: 404, error: "Order not found." };

  if (order.delivery_address && order.delivery_drive_minutes > 0 && order.delivery_address.trim().toLowerCase() === address.toLowerCase()) {
    return { ok: true, address: order.delivery_address, driveMinutes: order.delivery_drive_minutes };
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return { ok: false, status: 503, error: "Delivery scheduling isn't available right now. Please contact us directly." };

  const { data: settings } = await admin.from("delivery_settings").select("home_address").eq("id", 1).maybeSingle();
  if (!settings?.home_address) return { ok: false, status: 503, error: "Delivery scheduling isn't available right now. Please contact us directly." };

  try {
    const check = await geocodeAddress(address, apiKey);
    if (check.status === "unverified") return { ok: false, status: 422, error: check.reason };
    if (check.status === "confirm" && !confirmAddress) {
      return { ok: false, status: 200, error: "Please confirm this address.", needsConfirmation: true, suggestedAddress: check.formattedAddress, reason: check.reason };
    }
    const formatted = check.formattedAddress;
    const driveMinutes = await drivingDurationMinutes(settings.home_address, formatted, apiKey);
    const { error } = await admin.from("orders").update({ delivery_address: formatted, delivery_drive_minutes: driveMinutes }).eq("id", orderId);
    if (error) return { ok: false, status: 400, error: error.message };
    return { ok: true, address: formatted, driveMinutes };
  } catch (err) {
    return { ok: false, status: 502, error: err instanceof MapsError ? err.message : "Couldn't check that address right now." };
  }
}
