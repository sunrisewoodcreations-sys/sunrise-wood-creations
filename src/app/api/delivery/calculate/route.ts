import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { calculateDeliveryFeeCents, metersToMiles } from "@/lib/delivery";
import { geocodeAddress, drivingDistanceMeters, MapsError } from "@/lib/googleMaps";

// "Calculate delivery" in the quote editor. Admin only.
// 1. Checks the address is a real street address (Google Geocoding).
// 2. Measures the one-way driving distance from your home address.
// 3. Returns the fee: miles x your rate per mile, never below your minimum.
// It only calculates and returns numbers; it never saves anything. The
// quote editor fills the fee in, and you save the quote as usual.
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user?.id).single();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const address = typeof body.address === "string" ? body.address.trim() : "";
  const confirmAddress = body.confirmAddress === true;
  if (address.length < 5 || address.length > 200) {
    return NextResponse.json({ error: "Enter the delivery address." }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Google Maps isn't connected yet. The GOOGLE_MAPS_API_KEY setting is missing." }, { status: 503 });
  }

  const admin = createAdminClient();
  const { data: settings } = await admin.from("delivery_settings").select("*").eq("id", 1).maybeSingle();
  if (!settings?.home_address || !(settings.per_mile_cents > 0)) {
    return NextResponse.json(
      { error: "Set your home address and price per mile in Delivery Settings first.", needsSettings: true },
      { status: 400 }
    );
  }

  try {
    const check = await geocodeAddress(address, apiKey);
    if (check.status === "unverified") {
      return NextResponse.json({ error: check.reason }, { status: 422 });
    }
    if (check.status === "confirm" && !confirmAddress) {
      return NextResponse.json({ needsConfirmation: true, suggestedAddress: check.formattedAddress, reason: check.reason });
    }

    const meters = await drivingDistanceMeters(settings.home_address, check.formattedAddress, apiKey);
    const miles = metersToMiles(meters);
    const perMileCents = settings.per_mile_cents;
    const minimumCents = settings.minimum_fee_cents || 0;
    const feeCents = calculateDeliveryFeeCents({ miles, perMileCents, minimumCents });

    return NextResponse.json({
      ok: true,
      address: check.formattedAddress,
      miles,
      perMileCents,
      minimumCents,
      feeCents,
      minimumApplied: minimumCents > 0 && Math.round(miles * perMileCents) < minimumCents
    });
  } catch (err) {
    const message = err instanceof MapsError ? err.message : "Couldn't calculate delivery right now.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
