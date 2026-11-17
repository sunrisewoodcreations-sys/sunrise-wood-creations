process.env.RESEND_API_KEY = process.env.RESEND_API_KEY || "re_test_dummy";
const sent: any[] = [];
globalThis.fetch = (async (input: any, init?: any) => {
  const url = typeof input === "string" ? input : input?.url ?? String(input);
  const host = new URL(url).host;
  if (host === "api.resend.com") { sent.push(JSON.parse(init?.body ?? "{}")); return new Response(JSON.stringify({ id: "x" }), { status: 200, headers: { "content-type": "application/json" } }); }
  return new Response("img", { status: 200 });
}) as any;
(async () => {
  const { sendProofReadyEmail } = await import("../src/lib/email");
  let bad = 0;
  const t = (ok: boolean, m: string) => { if (!ok) { bad++; console.log("FAIL", m); } else console.log("ok  ", m); };
  const base = { toEmail: "c@e.com", customerName: "Pat", productType: "cornhole" as const, orderTitle: "Flag", orderId: "o", imageUrl: "https://x.test/a.jpg", respondToken: "tok" };
  await sendProofReadyEmail({ ...base, message: "I emailed you the actual design <b>small</b>" });
  t(sent[0].html.includes("I emailed you the actual design") && !sent[0].html.includes("<b>small</b>") && sent[0].html.includes("&lt;b&gt;"), "note appears in the email, safely escaped");
  await sendProofReadyEmail(base);
  t(!sent[1].html.includes("white-space: pre-line"), "no note, no extra box");
  process.exit(bad ? 1 : 0);
})();
