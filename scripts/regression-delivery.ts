// Regression tests for the delivery calculator (src/lib/delivery.ts, src/lib/googleMaps.ts).
// Run: npx tsx scripts/regression-delivery.ts
// No network: Google's responses are mocked in the shape their APIs return.

import assert from "node:assert/strict";
import {
  metersToMiles, calculateDeliveryFeeCents, assessGeocodeResult, parseRouteDistanceMeters,
  deliveryColumnsForCreate, deliveryColumnsForUpdate
} from "../src/lib/delivery";
import { geocodeAddress, drivingDistanceMeters, MapsError } from "../src/lib/googleMaps";

let n = 0;
async function test(label: string, fn: () => void | Promise<void>) {
  try { await fn(); n++; console.log(`PASS  ${label}`); }
  catch (err: any) { console.error(`FAIL  ${label}\n      ${err.message}`); process.exitCode = 1; }
}

const comp = (types: string[], short = "x") => ({ long_name: short, short_name: short, types });
const okAddress = (over: any = {}) => ({
  status: "OK",
  results: [{
    formatted_address: "123 Main St, Grand Rapids, MI 49503, USA",
    address_components: [comp(["street_number"]), comp(["route"]), comp(["country", "political"], "US")],
    geometry: { location_type: "ROOFTOP" },
    ...over
  }]
});
const fakeFetch = (json: any, ok = true, status = 200) => async () => ({ ok, status, json: async () => json });

(async () => {
  await test("metersToMiles rounds to 0.1", () => {
    assert.equal(metersToMiles(1609.344), 1);
    assert.equal(metersToMiles(20000), 12.4);
    assert.equal(metersToMiles(0), 0);
    assert.equal(metersToMiles(-5), 0);
  });
  await test("fee = miles x rate in cents", () => {
    assert.equal(calculateDeliveryFeeCents({ miles: 12.4, perMileCents: 125, minimumCents: 0 }), 1550);
  });
  await test("minimum fee applies when higher", () => {
    assert.equal(calculateDeliveryFeeCents({ miles: 2, perMileCents: 125, minimumCents: 1000 }), 1000);
    assert.equal(calculateDeliveryFeeCents({ miles: 20, perMileCents: 125, minimumCents: 1000 }), 2500);
  });
  await test("fee rounds to whole cents and ignores bad input", () => {
    assert.equal(calculateDeliveryFeeCents({ miles: 3.3, perMileCents: 105, minimumCents: 0 }), 347);
    assert.equal(calculateDeliveryFeeCents({ miles: NaN as any, perMileCents: 100, minimumCents: 0 }), 0);
    assert.equal(calculateDeliveryFeeCents({ miles: -4, perMileCents: 100, minimumCents: 0 }), 0);
  });
  await test("exact street address is verified", () => {
    const r = assessGeocodeResult(okAddress());
    assert.equal(r.status, "verified");
  });
  await test("interpolated address is verified", () => {
    assert.equal(assessGeocodeResult(okAddress({ geometry: { location_type: "RANGE_INTERPOLATED" } })).status, "verified");
  });
  await test("partial match needs confirmation", () => {
    const r = assessGeocodeResult(okAddress({ partial_match: true }));
    assert.equal(r.status, "confirm");
    assert.equal((r as any).formattedAddress, "123 Main St, Grand Rapids, MI 49503, USA");
  });
  await test("approximate location needs confirmation", () => {
    assert.equal(assessGeocodeResult(okAddress({ geometry: { location_type: "GEOMETRIC_CENTER" } })).status, "confirm");
  });
  await test("no results is unverified", () => {
    assert.equal(assessGeocodeResult({ status: "ZERO_RESULTS", results: [] }).status, "unverified");
  });
  await test("town or street only (no house number) is unverified", () => {
    const r = assessGeocodeResult(okAddress({ address_components: [comp(["route"]), comp(["country"], "US")] }));
    assert.equal(r.status, "unverified");
  });
  await test("non-US address is unverified", () => {
    const r = assessGeocodeResult(okAddress({ address_components: [comp(["street_number"]), comp(["route"]), comp(["country"], "CA")] }));
    assert.equal(r.status, "unverified");
  });
  await test("parseRouteDistanceMeters", () => {
    assert.equal(parseRouteDistanceMeters({ routes: [{ distanceMeters: 20000 }] }), 20000);
    assert.equal(parseRouteDistanceMeters({}), null);
    assert.equal(parseRouteDistanceMeters({ routes: [] }), null);
  });
  await test("geocodeAddress: OK, ZERO_RESULTS", async () => {
    assert.equal((await geocodeAddress("123 Main", "k", fakeFetch(okAddress()))).status, "verified");
    assert.equal((await geocodeAddress("zzz", "k", fakeFetch({ status: "ZERO_RESULTS", results: [] }))).status, "unverified");
  });
  await test("geocodeAddress: sends US restriction and key, encoded", async () => {
    let url = "";
    await geocodeAddress("1 A&B St", "KEY", async (u: string) => { url = u; return { ok: true, status: 200, json: async () => okAddress() }; });
    assert.ok(url.includes("components=country:US"));
    assert.ok(url.includes("address=1%20A%26B%20St"));
    assert.ok(url.includes("key=KEY"));
  });
  await test("geocodeAddress: denied, quota, network errors", async () => {
    await assert.rejects(() => geocodeAddress("a", "k", fakeFetch({ status: "REQUEST_DENIED" })), MapsError);
    await assert.rejects(() => geocodeAddress("a", "k", fakeFetch({ status: "OVER_QUERY_LIMIT" })), /limit/);
    await assert.rejects(() => geocodeAddress("a", "k", async () => { throw new Error("net"); }), MapsError);
  });
  await test("drivingDistanceMeters: sends origin/destination and returns meters", async () => {
    let init: any;
    const m = await drivingDistanceMeters("home", "dest", "KEY", async (_u: string, i: any) => { init = i; return { ok: true, status: 200, json: async () => ({ routes: [{ distanceMeters: 20000 }] }) }; });
    assert.equal(m, 20000);
    assert.equal(init.headers["X-Goog-Api-Key"], "KEY");
    assert.equal(init.headers["X-Goog-FieldMask"], "routes.distanceMeters");
    const b = JSON.parse(init.body);
    assert.equal(b.origin.address, "home");
    assert.equal(b.destination.address, "dest");
    assert.equal(b.travelMode, "DRIVE");
  });
  await test("drivingDistanceMeters: permission denied, no route, network", async () => {
    await assert.rejects(() => drivingDistanceMeters("a", "b", "k", fakeFetch({ error: { status: "PERMISSION_DENIED" } }, false, 403)), /Routes API/);
    await assert.rejects(() => drivingDistanceMeters("a", "b", "k", fakeFetch({}, true)), /route/);
    await assert.rejects(() => drivingDistanceMeters("a", "b", "k", async () => { throw new Error("net"); }), MapsError);
  });
  await test("end to end: 20 km at $1.25/mile = $15.50", async () => {
    const miles = metersToMiles(await drivingDistanceMeters("h", "d", "k", fakeFetch({ routes: [{ distanceMeters: 20000 }] })));
    assert.equal(calculateDeliveryFeeCents({ miles, perMileCents: 125, minimumCents: 0 }), 1550);
  });
  await test("create columns: nothing without an address, so old behavior is unchanged", () => {
    assert.deepEqual(deliveryColumnsForCreate(undefined, undefined), {});
    assert.deepEqual(deliveryColumnsForCreate("  ", 5), {});
    assert.deepEqual(deliveryColumnsForCreate(" 1 Main St ", 12.44), { delivery_address: "1 Main St", delivery_miles: 12.4 });
    assert.deepEqual(deliveryColumnsForCreate("1 Main St", null), { delivery_address: "1 Main St", delivery_miles: null });
  });
  await test("update columns: untouched when not sent; cleared when empty", () => {
    assert.deepEqual(deliveryColumnsForUpdate(undefined, undefined), {});
    assert.deepEqual(deliveryColumnsForUpdate("", 3), { delivery_address: null, delivery_miles: null });
    assert.deepEqual(deliveryColumnsForUpdate("1 Main St", 3), { delivery_address: "1 Main St", delivery_miles: 3 });
  });

  console.log(`\n${n} delivery tests passed`);
})();
