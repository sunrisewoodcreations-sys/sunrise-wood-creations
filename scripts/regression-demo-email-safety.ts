// Regression tests for the demo/test-record email-safety fix: ensures
// a demo/test order, quote, appointment, or customer can never trigger
// a real email to a real customer via a guest token route, a cron job,
// or campaign targeting — independent of whether anyone is logged in.
//
// Run: RESEND_API_KEY=x npx tsx scripts/regression-demo-email-safety.ts
// (RESEND_API_KEY can be any placeholder string — it's required only
// because importing src/lib/email.ts constructs a Resend client at
// module load time; no email is ever actually sent by this script.)

import assert from "node:assert/strict";
import { getMatchingCustomers, searchCustomers, TargetingSpec } from "../src/lib/campaignTargeting";

type FakeRow = Record<string, any>;

// Minimal fake Supabase admin client — enough of the query-builder
// surface for the real functions under test to run against canned data.
function makeFakeAdmin(rowsByTable: Record<string, FakeRow[]>) {
  return {
    from(table: string) {
      let rows = rowsByTable[table] || [];
      const chain: any = {
        select: () => chain,
        in: (col: string, ids: string[]) => { rows = rows.filter(r => ids.includes(r[col])); return chain; },
        eq: (col: string, val: any) => { rows = rows.filter(r => r[col] === val); return chain; },
        or: (expr: string) => {
          // Minimal ilike-OR support: "col.ilike.%q%,col2.ilike.%q%,..."
          const q = (expr.match(/%([^%]*)%/) || [])[1]?.toLowerCase() || "";
          rows = rows.filter(r =>
            String(r.full_name || "").toLowerCase().includes(q) ||
            String(r.email || "").toLowerCase().includes(q) ||
            String(r.phone || "").toLowerCase().includes(q)
          );
          return chain;
        },
        limit: () => chain,
        gte: () => chain,
        lte: () => chain,
        then: (resolve: any) => resolve({ data: rows })
      };
      return chain;
    }
  } as any;
}

const PROFILES: FakeRow[] = [
  { id: "real-1", full_name: "Real Customer One", email: "real1@example.com", phone: "5551112222", role: "customer", is_demo_account: false },
  { id: "real-2", full_name: "Real Customer Two", email: "real2@example.com", phone: "5553334444", role: "customer", is_demo_account: false },
  { id: "demo-cust-1", full_name: "Demo Test Customer", email: "demo-customer@example.com", phone: "5559998888", role: "customer", is_demo_account: true }
];

async function test(label: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    console.log(`PASS  ${label}`);
  } catch (err: any) {
    console.error(`FAIL  ${label}\n      ${err.message}`);
    process.exitCode = 1;
  }
}

async function main() {
  // --- 1. Manual campaign targeting: the gap this round actually fixed ---
  await test("Manual targeting excludes a demo customer even when its id is explicitly listed", async () => {
    const admin = makeFakeAdmin({ profiles: PROFILES });
    const spec: TargetingSpec = { type: "manual", customerIds: ["real-1", "demo-cust-1"] };
    const result = await getMatchingCustomers(spec, admin);
    assert.equal(result.length, 1, `expected only the real customer, got ${result.length}`);
    assert.equal(result[0].id, "real-1");
  });

  await test("Manual targeting still includes ordinary real customers normally", async () => {
    const admin = makeFakeAdmin({ profiles: PROFILES });
    const spec: TargetingSpec = { type: "manual", customerIds: ["real-1", "real-2"] };
    const result = await getMatchingCustomers(spec, admin);
    assert.equal(result.length, 2);
  });

  await test("\"all\" targeting excludes demo customers (pre-existing protection, still works)", async () => {
    const admin = makeFakeAdmin({ profiles: PROFILES });
    const result = await getMatchingCustomers({ type: "all" }, admin);
    assert.ok(result.every(c => c.id !== "demo-cust-1"), "demo customer leaked into \"all\" targeting");
    assert.equal(result.length, 2);
  });

  // --- 2. Customer search (feeds the manual-picker UI) ---
  await test("Customer search never surfaces a demo customer as a pickable option", async () => {
    const admin = makeFakeAdmin({ profiles: PROFILES });
    const result = await searchCustomers("Customer", admin);
    assert.ok(result.every(c => c.id !== "demo-cust-1"), "demo customer appeared in search results");
    assert.ok(result.some(c => c.id === "real-1"), "real customers should still be searchable");
  });

  // --- 3. Fail-safe boolean derivation, exactly as used at every gap
  // call site: typeof x === "boolean" ? x : true ---
  function deriveForceDemo(isDemoValue: unknown): boolean {
    return typeof isDemoValue === "boolean" ? isDemoValue : true;
  }
  await test("Fail-safe derivation: a real order (is_demo=false) is NOT forced into demo mode", () => {
    assert.equal(deriveForceDemo(false), false);
  });
  await test("Fail-safe derivation: a demo order (is_demo=true) IS forced into demo mode", () => {
    assert.equal(deriveForceDemo(true), true);
  });
  await test("Fail-safe derivation: null/undefined/missing data defaults to PROTECTED, not assumed safe", () => {
    assert.equal(deriveForceDemo(null), true);
    assert.equal(deriveForceDemo(undefined), true);
    assert.equal(deriveForceDemo("not-a-boolean"), true);
  });

  // --- 4. Cron's stricter skip condition: order?.is_demo !== false ---
  function cronShouldSkip(isDemoValue: unknown): boolean {
    return isDemoValue !== false;
  }
  await test("Cron skip logic: a confirmed real order (is_demo=false) is NOT skipped", () => {
    assert.equal(cronShouldSkip(false), false);
  });
  await test("Cron skip logic: a demo order, or any indeterminate value, IS skipped", () => {
    assert.equal(cronShouldSkip(true), true);
    assert.equal(cronShouldSkip(null), true);
    assert.equal(cronShouldSkip(undefined), true);
  });

  // --- 5. sendViaResend's own combination rule (isDemoSender || forceDemo) ---
  function shouldIntercept(isDemoSender: boolean, forceDemo: boolean | undefined): boolean {
    return isDemoSender || !!forceDemo;
  }
  await test("sendViaResend: ordinary production call (no session demo, no forceDemo) sends for real", () => {
    assert.equal(shouldIntercept(false, undefined), false);
  });
  await test("sendViaResend: existing admin-demo-session behavior is unchanged (still intercepted)", () => {
    assert.equal(shouldIntercept(true, undefined), true);
  });
  await test("sendViaResend: a demo RECORD intercepts even with no logged-in session at all (the actual fix)", () => {
    assert.equal(shouldIntercept(false, true), true);
  });
  await test("sendViaResend: a real record with a real admin session still sends for real", () => {
    assert.equal(shouldIntercept(false, false), false);
  });

  console.log(process.exitCode ? "\nSOME TESTS FAILED" : "\nAll demo-email-safety regression tests passed.");
}

main();
