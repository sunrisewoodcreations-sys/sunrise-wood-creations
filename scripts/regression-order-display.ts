// Regression tests for the customer-facing order number (SWC-1001 / DEMO-1)
// and the cleaned-up product line in order-status emails.
//
// Run: RESEND_API_KEY=x npx tsx scripts/regression-order-display.ts
// (Any placeholder works for RESEND_API_KEY; if you leave it off, this
// script sets a placeholder itself.)
//
// Safe by design: the end-to-end section runs the REAL sendOrderStatusEmail()
// but replaces the network layer with a stub that records what would have
// been sent and refuses every host except api.resend.com. No email is sent,
// no database is contacted, and no real customer address is used.

import assert from "node:assert/strict";
import { formatOrderNumber, matchesOrderNumberQuery, emailProductName } from "../src/lib/orderDisplay";

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
  // --- 1. formatOrderNumber -------------------------------------------
  await test("Real order: number 1001 shows as SWC-1001", () => {
    assert.equal(formatOrderNumber(1001, false), "SWC-1001");
  });
  await test("Demo order: shows as DEMO-3, never as an SWC number", () => {
    assert.equal(formatOrderNumber(3, true), "DEMO-3");
  });
  await test("Anything unclear returns null (so the email leaves the line out instead of guessing)", () => {
    assert.equal(formatOrderNumber(undefined, false), null);
    assert.equal(formatOrderNumber(null, false), null);
    assert.equal(formatOrderNumber("1001", false), null);
    assert.equal(formatOrderNumber(0, false), null);
    assert.equal(formatOrderNumber(-5, false), null);
    assert.equal(formatOrderNumber(10.5, false), null);
    assert.equal(formatOrderNumber(1001, undefined), null);
    assert.equal(formatOrderNumber(1001, null), null);
    assert.equal(formatOrderNumber(1001, "false"), null);
  });

  // --- 2. Admin search --------------------------------------------------
  await test("Admin search finds an order by SWC-1004, swc1004, #SWC-1004, and 1004", () => {
    for (const q of ["SWC-1004", "swc-1004", "swc1004", "#SWC-1004", "  SWC-1004  ", "1004"]) {
      assert.equal(matchesOrderNumberQuery(q, 1004, false), true, `"${q}" should match`);
    }
  });
  await test("Admin search is exact: 100, 10, SWC-100 and SWC-10040 do NOT match 1004", () => {
    for (const q of ["100", "10", "SWC-100", "SWC-10040", "10040", "swc"]) {
      assert.equal(matchesOrderNumberQuery(q, 1004, false), false, `"${q}" should not match`);
    }
  });
  await test("Admin search: a real order is not matched by a DEMO- query, and vice versa", () => {
    assert.equal(matchesOrderNumberQuery("DEMO-1004", 1004, false), false);
    assert.equal(matchesOrderNumberQuery("SWC-3", 3, true), false);
    assert.equal(matchesOrderNumberQuery("DEMO-3", 3, true), true);
  });
  await test("Admin search: empty query and orders with no number never match", () => {
    assert.equal(matchesOrderNumberQuery("", 1004, false), false);
    assert.equal(matchesOrderNumberQuery("1004", undefined, false), false);
  });

  // --- 3. Product line ----------------------------------------------------
  const planter = (t: string) => emailProductName(t, "planter");
  await test("Every planter name in the product list loses the label and the trailing Box", () => {
    const cases: [string, string][] = [
      ["36x18x18 Cedar Planter Box", "36x18x18 Cedar Planter"],
      ["36x18x24 Cedar Planter Box", "36x18x24 Cedar Planter"],
      ["36x18x30 Cedar Planter Box", "36x18x30 Cedar Planter"],
      ["48x18x18 Cedar Planter Box", "48x18x18 Cedar Planter"],
      ["48x18x24 Cedar Planter Box", "48x18x24 Cedar Planter"],
      ["48x18x30 Cedar Planter Box", "48x18x30 Cedar Planter"],
      ["48x24x30 Cedar Planter Box", "48x24x30 Cedar Planter"]
    ];
    for (const [stored, expected] of cases) assert.equal(planter(stored), expected);
  });
  await test("Multi-item planter order: only the first name is cleaned, the '+ N more' tail is kept", () => {
    assert.equal(planter("36x18x18 Cedar Planter Box + 1 more item"), "36x18x18 Cedar Planter + 1 more item");
    assert.equal(planter("36x18x18 Cedar Planter Box + 3 more items"), "36x18x18 Cedar Planter + 3 more items");
  });
  await test("A planter whose name doesn't say 'planter' keeps its label (exactly as today)", () => {
    assert.equal(planter("36x18x15 With Trellis"), "Planter box — 36x18x15 With Trellis");
    assert.equal(planter("Herb Box"), "Planter box — Herb Box");
  });
  await test("Capitalisation is preserved, and only a TRAILING 'Planter Box' loses 'Box'", () => {
    assert.equal(planter("Cedar planter box"), "Cedar planter");
    assert.equal(planter("Planter Box Deluxe"), "Planter Box Deluxe");
  });
  await test("Non-planter products are unchanged from what the email showed before", () => {
    assert.equal(emailProductName("Test", "cornhole"), "Cornhole boards — Test");
    assert.equal(emailProductName("Welcome Sign", "sign"), "Wooden sign — Welcome Sign");
    assert.equal(emailProductName("Walnut Board", "cutting_board"), "Cutting board — Walnut Board");
  });

  // --- 4. End to end: the REAL sendOrderStatusEmail, network stubbed ------
  process.env.RESEND_API_KEY = process.env.RESEND_API_KEY || "re_test_dummy_key_for_regression_test_only";

  type Captured = { url: string; to: string; subject: string; html: string };
  const captured: Captured[] = [];
  const blockedHosts: string[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: any, init?: any) => {
    const url = typeof input === "string" ? input : input?.url ?? String(input);
    const host = new URL(url).host;
    if (host !== "api.resend.com") {
      blockedHosts.push(host);
      throw new Error(`Test stub refused a request to ${host}`);
    }
    const body = JSON.parse(init?.body ?? "{}");
    captured.push({ url, to: String(body.to), subject: body.subject, html: body.html });
    return new Response(JSON.stringify({ id: "stubbed-no-email-was-sent" }), { status: 200, headers: { "content-type": "application/json" } });
  }) as any;

  try {
    const { sendOrderStatusEmail } = await import("../src/lib/email");
    const ORDER_ID = "aa8a9301-f00d-45a5-a5ee-c03763ce606b";
    const baseOpts = {
      toEmail: "customer@example.com",
      customerName: "Test Customer",
      productType: "planter" as const,
      orderTitle: "36x18x30 Cedar Planter Box",
      orderId: ORDER_ID,
      newStatus: "order_placed"
    };

    await test("Email shows 'Order SWC-1001' and '36x18x30 Cedar Planter' - no 'Planter box —', no trailing 'Box', no old hex code", async () => {
      captured.length = 0;
      await sendOrderStatusEmail({ ...baseOpts, priceCents: 6500, amountPaidCents: 0, orderNumberDisplay: "SWC-1001" });
      assert.equal(captured.length, 1, "expected exactly one email to be handed to the (stubbed) sender");
      const html = captured[0].html;
      assert.ok(html.includes("Order SWC-1001"), "missing 'Order SWC-1001'");
      assert.ok(/>36x18x30 Cedar Planter</.test(html), "product line should be exactly '36x18x30 Cedar Planter'");
      assert.ok(!html.includes("Planter box —"), "old 'Planter box —' label is still there");
      assert.ok(!html.includes("Cedar Planter Box"), "trailing 'Box' is still there");
      assert.ok(!/Order #?[0-9A-F]{8}\b/.test(html), "old random-looking code is still there");
    });

    await test("Email still carries the payment block and the View Your Order button built on the internal order id", async () => {
      captured.length = 0;
      await sendOrderStatusEmail({ ...baseOpts, priceCents: 6500, amountPaidCents: 0, orderNumberDisplay: "SWC-1001" });
      const html = captured[0].html;
      assert.ok(html.includes("Order Total") && html.includes("$65.00"), "order total missing");
      assert.ok(html.includes("Unpaid"), "payment status missing");
      assert.ok(html.includes(`/account/orders/${ORDER_ID}`), "View Your Order link must still use the internal order id");
      assert.ok(!html.includes("/account/orders/SWC"), "link must never be built from the display number");
    });

    await test("A demo order's email shows DEMO-3, never an SWC number", async () => {
      captured.length = 0;
      await sendOrderStatusEmail({ ...baseOpts, orderNumberDisplay: "DEMO-3" });
      assert.ok(captured[0].html.includes("Order DEMO-3"));
      assert.ok(!captured[0].html.includes("SWC-"));
    });

    await test("If the number can't be found (lookup fails / migration not run yet), the email still sends, just without the Order line", async () => {
      captured.length = 0;
      await sendOrderStatusEmail({ ...baseOpts });
      assert.equal(captured.length, 1, "email must still be sent");
      const html = captured[0].html;
      assert.ok(!/Order (SWC|DEMO)-/.test(html), "no order line should appear");
      assert.ok(!/Order #/.test(html), "no old-style order line should appear");
      assert.ok(html.includes("36x18x30 Cedar Planter"), "rest of the email must be intact");
      assert.ok(html.includes("View Your Order"), "button must still be there");
    });

    await test("The cleaned product line applies to every status email, not just order-placed", async () => {
      for (const status of ["being_built", "ready_for_pickup", "picked_up"]) {
        captured.length = 0;
        await sendOrderStatusEmail({ ...baseOpts, newStatus: status, orderNumberDisplay: "SWC-1001" });
        assert.ok(/>36x18x30 Cedar Planter</.test(captured[0].html), `status ${status}`);
        assert.ok(!captured[0].html.includes("Planter box —"), `status ${status}`);
      }
    });

    await test("Non-planter order email is unchanged: 'Cornhole boards — Test'", async () => {
      captured.length = 0;
      await sendOrderStatusEmail({ ...baseOpts, productType: "cornhole", orderTitle: "Test", newStatus: "order_placed", orderNumberDisplay: "SWC-1002" });
      assert.ok(captured[0].html.includes(">Cornhole boards — Test<"));
    });

    await test("Demo-email protection still holds: a demo-flagged email is never delivered to the real recipient", async () => {
      captured.length = 0;
      let threw = false;
      try {
        await sendOrderStatusEmail({ ...baseOpts, forceDemo: true, orderNumberDisplay: "DEMO-3" });
      } catch {
        threw = true; // no database is configured in this test, so the demo log insert can't run - that's expected
      }
      assert.ok(
        !captured.some(c => c.to.includes("customer@example.com")),
        "a demo-flagged email reached the real recipient"
      );
      void threw;
    });

    await test("Nothing in this test ever contacted any host other than the stubbed email API", () => {
      assert.deepEqual(blockedHosts, []);
    });
  } finally {
    globalThis.fetch = realFetch;
  }

  console.log(process.exitCode ? "\nSOME TESTS FAILED" : "\nAll order-display regression tests passed.");
}

main();
