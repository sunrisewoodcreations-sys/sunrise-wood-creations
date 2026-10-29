// Regression tests for the Picket Planner calculation (src/lib/picketPlanner.ts).
//
// Run: npx tsx scripts/regression-picket-planner.ts
//
// Pure calculation tests — no database, no network, no email.

import assert from "node:assert/strict";
import { BOMPart } from "../src/lib/cutlistOptimizer";
import { planFromPickets, measureCutList, PlannerProduct } from "../src/lib/picketPlanner";

async function test(label: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    console.log(`PASS  ${label}`);
  } catch (err: any) {
    console.error(`FAIL  ${label}\n      ${err.message}`);
    process.exitCode = 1;
  }
}

const part = (partName: string, length: number, quantityPerUnit: number, extra: Partial<BOMPart> = {}): BOMPart => ({
  partName, length, quantityPerUnit, materialType: "Cedar", isTrim: false, ...extra
});
const product = (id: string, parts: BOMPart[]): PlannerProduct => ({ id, name: id.toUpperCase(), parts });

// Small deterministic random number generator so "random" tests are repeatable.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

async function main() {
  await test("Hand-checked: 3 pieces of 23.5\" fit per picket (3 x 23.625 = 70.875), 2 pieces per unit -> 160 pickets make 240 units", () => {
    const a = product("a", [part("Slat", 23.5, 2)]);
    const plan = planFromPickets([a], [{ id: "a", ratio: 1 }], 160);
    assert.equal(plan.lines[0].totalUnits, 240);
    assert.equal(plan.picketsUsed, 160);
    assert.equal(plan.picketsLeft, 0);
  });

  await test("Hand-checked: 24\" pieces fit only 2 per picket (3 x 24.125 = 72.4 > 71), 2 per unit -> 160 pickets make exactly 160 units", () => {
    const a = product("a", [part("Slat", 24, 2)]);
    const plan = planFromPickets([a], [{ id: "a", ratio: 1 }], 160);
    assert.equal(plan.lines[0].totalUnits, 160);
    assert.equal(plan.picketsUsed, 160);
  });

  await test("Small parts: three 23.5-inch pieces per picket (3 x 23.625 = 70.875 fits) -> 1 piece per unit gives 3 units per picket", () => {
    const a = product("a", [part("Slat", 23.5, 1)]);
    const plan = planFromPickets([a], [{ id: "a", ratio: 1 }], 10);
    assert.equal(plan.lines[0].totalUnits, 30);
    assert.equal(plan.picketsUsed, 10);
  });

  await test("Zero pickets, no selection, or ratio 0 build nothing", () => {
    const a = product("a", [part("Slat", 20, 2)]);
    assert.equal(planFromPickets([a], [{ id: "a", ratio: 1 }], 0).lines[0].totalUnits, 0);
    assert.equal(planFromPickets([a], [], 160).lines.length, 0);
    assert.equal(planFromPickets([a], [{ id: "a", ratio: 0 }], 160).lines.length, 0);
  });

  await test("Mix ratio 2:1 builds full sets in that ratio, then uses leftovers for extras", () => {
    const a = product("a", [part("Long", 40, 2)]); // 1 per picket-ish
    const b = product("b", [part("Short", 12, 4)]);
    const plan = planFromPickets([a, b], [{ id: "a", ratio: 2 }, { id: "b", ratio: 1 }], 60);
    const la = plan.lines.find(l => l.id === "a")!;
    const lb = plan.lines.find(l => l.id === "b")!;
    assert.equal(la.plannedUnits, 2 * plan.sets);
    assert.equal(lb.plannedUnits, 1 * plan.sets);
    assert.equal(la.totalUnits, la.plannedUnits + la.extraUnits);
    assert.ok(plan.picketsUsed <= 60);
  });

  await test("Property: every plan fits, is maximal, and its cut list contains exactly the parts needed", () => {
    const r = rng(12345);
    for (let trial = 0; trial < 40; trial++) {
      const n = 1 + Math.floor(r() * 3);
      const products: PlannerProduct[] = [];
      for (let i = 0; i < n; i++) {
        const nParts = 1 + Math.floor(r() * 4);
        const parts: BOMPart[] = [];
        for (let j = 0; j < nParts; j++) {
          parts.push(part(`P${i}-${j}`, 4 + Math.floor(r() * 62), 1 + Math.floor(r() * 4), { isTrim: r() < 0.2 }));
        }
        products.push(product(`p${i}`, parts));
      }
      const requests = products.map(p => ({ id: p.id, ratio: 1 + Math.floor(r() * 3) }));
      const pickets = 5 + Math.floor(r() * 60);
      const plan = planFromPickets(products, requests, pickets);

      // 1. fits
      assert.ok(plan.picketsUsed <= pickets, `trial ${trial}: uses ${plan.picketsUsed} of ${pickets}`);

      // 2. recount independently from the final quantities
      const counts: Record<string, number> = {};
      plan.lines.forEach(l => { counts[l.id] = l.totalUnits; });
      const recount = measureCutList(products, counts, 71, 0.125);
      assert.equal(recount.picketsUsed, plan.picketsUsed, `trial ${trial}: recount differs`);

      // 3. maximal: one more of any single product no longer fits
      for (const l of plan.lines) {
        const more = measureCutList(products, { ...counts, [l.id]: counts[l.id] + 1 }, 71, 0.125);
        assert.ok(more.picketsUsed > pickets, `trial ${trial}: could still add one ${l.id}`);
      }

      // 4. the cut list has exactly the required pieces, and no board is over-full
      const needed = new Map<string, number>();
      for (const p of products) for (const pt of p.parts) {
        const k = `${pt.partName}:${pt.length}:${pt.isTrim}`;
        needed.set(k, (needed.get(k) || 0) + pt.quantityPerUnit * (counts[p.id] || 0));
      }
      const got = new Map<string, number>();
      const addResults = (results: typeof plan.normalResults, isTrim: boolean) => {
        for (const res of results) for (const board of res.boards) {
          const used = board.pieces.reduce((s, pc) => s + pc.length + 0.125, 0);
          assert.ok(used <= 71 + 1e-9, `trial ${trial}: board over-full (${used})`);
          for (const pc of board.pieces) {
            const k = `${pc.partName}:${pc.length}:${isTrim}`;
            got.set(k, (got.get(k) || 0) + 1);
          }
        }
      };
      addResults(plan.normalResults, false);
      addResults(plan.trimResults, true);
      for (const [k, v] of needed) if (v > 0) assert.equal(got.get(k) || 0, v, `trial ${trial}: piece count for ${k}`);
      for (const [k, v] of got) assert.equal(needed.get(k) || 0, v, `trial ${trial}: unexpected piece ${k}`);
    }
  });

  await test("Trim parts stay on their own pickets, never mixed with standard parts", () => {
    const a = product("a", [part("Body", 30, 1), part("Trim", 30, 1, { isTrim: true })]);
    const plan = planFromPickets([a], [{ id: "a", ratio: 1 }], 10);
    const normalPieces = plan.normalResults.flatMap(r => r.boards.flatMap(b => b.pieces.map(p => p.partName)));
    const trimPieces = plan.trimResults.flatMap(r => r.boards.flatMap(b => b.pieces.map(p => p.partName)));
    assert.ok(normalPieces.every(n => n === "Body"));
    assert.ok(trimPieces.every(n => n === "Trim"));
    assert.ok(plan.picketsUsed <= 10);
  });

  await test("'cedar' / 'Cedar' / ' CEDAR ' all count as picket stock and pack together", () => {
    const a = product("a", [part("Short1", 30, 1, { materialType: "cedar" }), part("Short2", 30, 1, { materialType: " CEDAR " })]);
    const plan = planFromPickets([a], [{ id: "a", ratio: 1 }], 10);
    // 2 x 30.125 = 60.25 fits on one picket -> one unit per picket if packed together.
    assert.equal(plan.lines[0].totalUnits, 10);
    assert.equal(plan.normalResults.length, 1);
  });

  await test("Non-cedar parts are listed as other materials and do not limit the plan", () => {
    const a = product("a", [part("Slat", 30, 2), part("Backer", 20, 3, { materialType: "Plywood" })]);
    const plan = planFromPickets([a], [{ id: "a", ratio: 1 }], 10);
    assert.equal(plan.lines[0].totalUnits, 10);
    assert.equal(plan.otherMaterials.length, 1);
    assert.equal(plan.otherMaterials[0].materialType, "Plywood");
    assert.equal(plan.otherMaterials[0].parts[0].quantity, 30);
  });

  await test("A product with an over-length cedar part, or no cedar parts, is excluded with a reason", () => {
    const tooLong = product("long", [part("Rail", 80, 1)]);
    const noCedar = product("pine", [part("Block", 10, 1, { materialType: "Pine" })]);
    const ok = product("ok", [part("Slat", 20, 2)]);
    const plan = planFromPickets([tooLong, noCedar, ok], [{ id: "long", ratio: 1 }, { id: "pine", ratio: 1 }, { id: "ok", ratio: 1 }], 20);
    assert.deepEqual(plan.excluded.map(e => e.id).sort(), ["long", "pine"]);
    assert.equal(plan.lines.length, 1);
    assert.ok(plan.lines[0].totalUnits > 0);
  });

  await test("'Alone' figure: how many of just that product the pickets would make", () => {
    const a = product("a", [part("Slat", 23.5, 2)]);
    const b = product("b", [part("Slat", 35, 1)]);
    const plan = planFromPickets([a, b], [{ id: "a", ratio: 1 }, { id: "b", ratio: 1 }], 40);
    assert.equal(plan.lines.find(l => l.id === "a")!.aloneMax, 60); // 3 pieces per picket, 2 per unit: 40 x 3 / 2
    assert.equal(plan.lines.find(l => l.id === "b")!.aloneMax, 80); // 2 pieces per picket (2 x 35.125 = 70.25), 1 per unit: 40 x 2
  });

  await test("Calculation is fast for a realistic year-start run (160 pickets, 4 products)", () => {
    const products = [
      product("planter", [part("Side", 21.5, 4), part("End", 14, 4), part("Slat", 18, 6), part("Trim", 22, 4, { isTrim: true })]),
      product("sign", [part("Board", 36, 3), part("Brace", 12, 2)]),
      product("cutting", [part("Stave", 17, 8)]),
      product("box", [part("Panel", 24, 6), part("Rail", 10, 4)])
    ];
    const t0 = Date.now();
    const plan = planFromPickets(products, products.map(p => ({ id: p.id, ratio: 1 })), 160);
    const ms = Date.now() - t0;
    assert.ok(plan.picketsUsed <= 160);
    assert.ok(ms < 5000, `took ${ms}ms`);
  });

  console.log(process.exitCode ? "\nSOME TESTS FAILED" : "\nAll picket-planner regression tests passed.");
}

main();
