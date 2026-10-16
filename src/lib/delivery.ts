// Pure helpers for the delivery-fee calculator. No network and no database
// in this file, so everything here is easy to test.

export const METERS_PER_MILE = 1609.344;

// Driving distance in meters -> miles, to one decimal place. The fee is
// worked out from this same rounded figure, so the math shown to you
// ("12.4 miles x $1.25") always adds up to the fee that is filled in.
export function metersToMiles(meters: number): number {
  const m = Math.max(0, Number(meters) || 0);
  return Math.round((m / METERS_PER_MILE) * 10) / 10;
}

// One-way: miles x rate per mile, never less than the minimum fee. All
// money in whole cents.
export function calculateDeliveryFeeCents(opts: { miles: number; perMileCents: number; minimumCents: number }): number {
  const miles = Math.max(0, Number(opts.miles) || 0);
  const perMile = Math.max(0, Math.round(Number(opts.perMileCents) || 0));
  const minimum = Math.max(0, Math.round(Number(opts.minimumCents) || 0));
  return Math.max(minimum, Math.round(miles * perMile));
}

export type AddressCheck =
  | { status: "verified"; formattedAddress: string }
  | { status: "confirm"; formattedAddress: string; reason: string }
  | { status: "unverified"; reason: string };

// Decides whether what Google's Geocoding API returned is a real, specific
// street address. "verified" = exact match; "confirm" = Google found a
// likely match but had to correct or estimate something, so you should
// confirm the corrected address before it is used; "unverified" = not a
// full street address, or not found.
export function assessGeocodeResult(json: any): AddressCheck {
  const results = Array.isArray(json?.results) ? json.results : [];
  if (json?.status === "ZERO_RESULTS" || results.length === 0) {
    return { status: "unverified", reason: "We couldn't find that address. Check the spelling and include the house number, street, and town." };
  }

  const top = results[0];
  const comps: any[] = Array.isArray(top?.address_components) ? top.address_components : [];
  const has = (type: string) => comps.some(c => Array.isArray(c?.types) && c.types.includes(type));
  const formatted = typeof top?.formatted_address === "string" ? top.formatted_address : "";

  const country = comps.find(c => Array.isArray(c?.types) && c.types.includes("country"));
  if (country && country.short_name !== "US") {
    return { status: "unverified", reason: "That address isn't in the United States." };
  }
  if (!formatted || !has("street_number") || !has("route")) {
    return { status: "unverified", reason: "That looks like a street, town, or area rather than a full street address. Include the house number." };
  }

  const locationType = top?.geometry?.location_type;
  const precise = locationType === "ROOFTOP" || locationType === "RANGE_INTERPOLATED";
  if (top?.partial_match === true || !precise) {
    return {
      status: "confirm",
      formattedAddress: formatted,
      reason: top?.partial_match === true
        ? "Google matched this to a slightly different address."
        : "Google could only estimate this address's exact location."
    };
  }
  return { status: "verified", formattedAddress: formatted };
}

// Reads the driving distance (meters) out of a Routes API response.
export function parseRouteDistanceMeters(json: any): number | null {
  const meters = json?.routes?.[0]?.distanceMeters;
  return typeof meters === "number" && Number.isFinite(meters) && meters >= 0 ? meters : null;
}

function cleanMiles(miles: unknown): number | null {
  if (miles === null || miles === undefined || miles === "") return null;
  const m = Number(miles);
  return Number.isFinite(m) && m >= 0 ? Math.round(m * 10) / 10 : null;
}

// The two extra quote columns, for saving a quote.
// Create: nothing is written unless an address was actually calculated, so
// a quote with no delivery address behaves exactly as before.
export function deliveryColumnsForCreate(address: unknown, miles: unknown): { delivery_address?: string; delivery_miles?: number | null } {
  const a = typeof address === "string" ? address.trim().slice(0, 300) : "";
  if (!a) return {};
  return { delivery_address: a, delivery_miles: cleanMiles(miles) };
}

// Update: if the editor sent the address (even empty) it replaces what was
// stored; if it sent nothing, nothing is touched.
export function deliveryColumnsForUpdate(address: unknown, miles: unknown): { delivery_address?: string | null; delivery_miles?: number | null } {
  if (address === undefined) return {};
  const a = typeof address === "string" ? address.trim().slice(0, 300) : "";
  if (!a) return { delivery_address: null, delivery_miles: null };
  return { delivery_address: a, delivery_miles: cleanMiles(miles) };
}
