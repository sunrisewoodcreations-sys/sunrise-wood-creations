import assert from "node:assert/strict";
process.env.RESEND_API_KEY = process.env.RESEND_API_KEY || "re_test_dummy";
const captured: { subject: string; html: string }[] = [];
globalThis.fetch = (async (input: any, init?: any) => {
  const url = typeof input === "string" ? input : input?.url ?? String(input);
  if (new URL(url).host !== "api.resend.com") throw new Error("blocked " + url);
  const b = JSON.parse(init?.body ?? "{}");
  captured.push({ subject: b.subject, html: b.html });
  return new Response(JSON.stringify({ id: "x" }), { status: 200, headers: { "content-type": "application/json" } });
}) as any;

(async () => {
  const { sendOrderStatusEmail } = await import("../src/lib/email");
  const base = { toEmail: "c@example.com", customerName: "Pat", productType: "cornhole" as const, orderTitle: "Michigan flag", orderId: "aa8a9301-f00d-45a5-a5ee-c03763ce606b", newStatus: "deposit_received", orderNumberDisplay: "SWC-1001" };
  let bad = 0;
  const t = (ok: boolean, m: string) => { if (!ok) { bad++; console.log("FAIL", m); } else console.log("ok  ", m); };

  await sendOrderStatusEmail({ ...base, priceCents: 30000, amountPaidCents: 10000 });
  let h = captured[0].html;
  t(h.includes("Deposit Received"), "heading");
  t(h.includes("$300.00") && h.includes("$100.00") && h.includes("$200.00"), "shows total, paid so far and balance");
  t(h.includes("Balance due at pickup"), "says balance due at pickup");

  captured.length = 0;
  await sendOrderStatusEmail({ ...base, priceCents: 30000, amountPaidCents: 30000, fulfillmentMethod: "delivery" });
  h = captured[0].html;
  t(h.includes("Paid in full") && !h.includes("Balance due at"), "fully paid says Paid in full");

  captured.length = 0;
  await sendOrderStatusEmail({ ...base, priceCents: 30000, amountPaidCents: 5000, fulfillmentMethod: "delivery" });
  t(captured[0].html.includes("Balance due at delivery"), "delivery wording");
  process.exit(bad ? 1 : 0);
})();
