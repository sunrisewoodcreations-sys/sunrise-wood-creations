import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { geocodeAddress, MapsError } from "@/lib/googleMaps";

async function requireAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user?.id).single();
  return profile?.role === "admin";
}

// Saves the home address, price per mile, and minimum fee. Admin only.
// The home address is checked with Google when the key is set up, so a
// typo here can't quietly throw off every delivery quote.
export async function PUT(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  let homeAddress = typeof body.homeAddress === "string" ? body.homeAddress.trim() : "";
  const perMileCents = Math.round(Number(body.perMileCents));
  const minimumCents = Math.round(Number(body.minimumCents) || 0);
  const confirmAddress = body.confirmAddress === true;

  if (homeAddress.length < 5 || homeAddress.length > 200) {
    return NextResponse.json({ error: "Enter your home address." }, { status: 400 });
  }
  if (!Number.isFinite(perMileCents) || perMileCents <= 0 || perMileCents > 2000) {
    return NextResponse.json({ error: "Enter a price per mile between $0.01 and $20.00." }, { status: 400 });
  }
  if (minimumCents < 0 || minimumCents > 50000) {
    return NextResponse.json({ error: "Minimum fee must be between $0 and $500." }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  let note: string | undefined;
  if (apiKey) {
    try {
      const check = await geocodeAddress(homeAddress, apiKey);
      if (check.status === "unverified") {
        return NextResponse.json({ error: check.reason }, { status: 422 });
      }
      if (check.status === "confirm" && !confirmAddress) {
        return NextResponse.json({ needsConfirmation: true, suggestedAddress: check.formattedAddress, reason: check.reason });
      }
      homeAddress = check.formattedAddress;
    } catch (err) {
      return NextResponse.json({ error: err instanceof MapsError ? err.message : "Couldn't check that address." }, { status: 502 });
    }
  } else {
    note = "Saved, but the address wasn't checked because Google Maps isn't connected yet.";
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("delivery_settings")
    .upsert({ id: 1, home_address: homeAddress, per_mile_cents: perMileCents, minimum_fee_cents: minimumCents }, { onConflict: "id" });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true, homeAddress, note });
}
