import { assessGeocodeResult, parseRouteDistanceMeters, AddressCheck } from "./delivery";

// The only two calls to Google Maps in the app. Server-side only: the
// access key (GOOGLE_MAPS_API_KEY) is never sent to the browser.
// fetchImpl is a parameter so tests can run this without the network.

export class MapsError extends Error {}

type FetchLike = (input: string, init?: any) => Promise<{ ok: boolean; status: number; json: () => Promise<any> }>;

// Looks an address up and says whether it is a real street address.
export async function geocodeAddress(address: string, apiKey: string, fetchImpl: FetchLike = fetch as any): Promise<AddressCheck> {
  const url =
    "https://maps.googleapis.com/maps/api/geocode/json" +
    `?address=${encodeURIComponent(address)}&components=country:US&key=${encodeURIComponent(apiKey)}`;
  let json: any;
  try {
    const res = await fetchImpl(url);
    json = await res.json();
  } catch {
    throw new MapsError("Couldn't reach Google Maps. Try again in a moment.");
  }
  if (json?.status === "OK" || json?.status === "ZERO_RESULTS") {
    return assessGeocodeResult(json);
  }
  if (json?.status === "REQUEST_DENIED") {
    throw new MapsError("Google Maps refused the request. Check that the Geocoding API is enabled for your key.");
  }
  if (json?.status === "OVER_QUERY_LIMIT" || json?.status === "OVER_DAILY_LIMIT") {
    throw new MapsError("Google Maps usage limit reached. Try again later or check your Google billing.");
  }
  throw new MapsError("Google Maps couldn't check that address right now.");
}

// Driving distance in meters between two addresses, on the fastest road
// route (one way).
export async function drivingDistanceMeters(origin: string, destination: string, apiKey: string, fetchImpl: FetchLike = fetch as any): Promise<number> {
  let res: { ok: boolean; status: number; json: () => Promise<any> };
  try {
    res = await fetchImpl("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "routes.distanceMeters"
      },
      body: JSON.stringify({
        origin: { address: origin },
        destination: { address: destination },
        travelMode: "DRIVE"
      })
    });
  } catch {
    throw new MapsError("Couldn't reach Google Maps. Try again in a moment.");
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const status = json?.error?.status;
    if (status === "PERMISSION_DENIED") {
      throw new MapsError("Google Maps refused the request. Check that the Routes API is enabled for your key.");
    }
    throw new MapsError("Google Maps couldn't work out the driving distance right now.");
  }
  const meters = parseRouteDistanceMeters(json);
  if (meters === null) {
    throw new MapsError("Google Maps couldn't find a driving route to that address.");
  }
  return meters;
}

// Address suggestions while typing (Google Places Autocomplete, "new" API).
// Returns up to 5 full address strings, US only. Returns [] when there is
// nothing to suggest. Throws MapsError only for setup problems (key
// refused / API not enabled) so the caller can decide how loud to be.
export async function suggestAddresses(input: string, apiKey: string, fetchImpl: FetchLike = fetch as any): Promise<string[]> {
  const text = (input || "").trim();
  if (text.length < 3) return [];
  let res: { ok: boolean; status: number; json: () => Promise<any> };
  try {
    res = await fetchImpl("https://places.googleapis.com/v1/places:autocomplete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "suggestions.placePrediction.text.text"
      },
      body: JSON.stringify({ input: text.slice(0, 120), includedRegionCodes: ["us"] })
    });
  } catch {
    throw new MapsError("Couldn't reach Google Maps.");
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (json?.error?.status === "PERMISSION_DENIED") {
      throw new MapsError("Google refused address suggestions. Check that the Places API (New) is enabled for your key.");
    }
    throw new MapsError("Address suggestions aren't available right now.");
  }
  const out: string[] = [];
  for (const s of Array.isArray(json?.suggestions) ? json.suggestions : []) {
    const t = s?.placePrediction?.text?.text;
    if (typeof t === "string" && t.trim() && !out.includes(t.trim())) out.push(t.trim());
    if (out.length >= 5) break;
  }
  return out;
}
