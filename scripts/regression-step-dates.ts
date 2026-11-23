import { applyStepDates, normalizeDateOnly } from "../src/lib/stepDates";
const eq = (a: any, b: any, m: string) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(m + ": " + JSON.stringify(a)); };
eq(normalizeDateOnly("2026-11-23T00:00:00+00:00".replace("+00:00", "Z")), "2026-11-23T16:00:00.000Z", "legacy midnight");
eq(normalizeDateOnly("2026-11-23T15:20:00.000Z"), "2026-11-23T15:20:00.000Z", "real time kept");
const r = applyStepDates({ order_placed: "2026-11-22T22:22:00Z", deposit_received: "2026-11-23T15:20:00Z" }, { created_at: "2026-11-20T00:00:00.000Z" }, "2026-11-21T16:00:00.000Z");
eq(r.order_placed, "2026-11-20T16:00:00.000Z", "placed follows order date"); eq(r.deposit_received, "2026-11-21T16:00:00.000Z", "deposit follows payment");
eq(applyStepDates({ order_placed: "x" }, { created_at: "2026-11-20T10:00:00Z" }, "2026-11-21T16:00:00Z").deposit_received, undefined, "no deposit step -> none added");
console.log("step dates ok");
