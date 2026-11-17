import { isLikelyBot, proofViewedLabel, recordProofView } from "../src/lib/proofViews";
let bad = 0;
const t = (ok: boolean, m: string) => { if (!ok) { bad++; console.log("FAIL", m); } else console.log("ok  ", m); };
const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
t(!isLikelyBot(iphone), "a real iPhone browser counts");
t(isLikelyBot("Mozilla/5.0 (compatible; Googlebot/2.1)") && isLikelyBot("facebookexternalhit/1.1") && isLikelyBot(null) && isLikelyBot("GoogleImageProxy"), "bots, link previews and missing user-agents are ignored");
t(proofViewedLabel({}) === "Not viewed yet", "label: not viewed");
t(/^Viewed Nov 17, 2:05 PM ET$/.test(proofViewedLabel({ first_viewed_at: "2026-11-17T19:05:00Z", last_viewed_at: "2026-11-17T19:05:00Z", view_count: 1 })), "label: viewed once");
t(proofViewedLabel({ first_viewed_at: "2026-11-17T19:05:00Z", last_viewed_at: "2026-11-17T20:00:00Z", view_count: 3 }).endsWith("· 3 views"), "label: several views");
(async () => {
  const calls: any[] = [];
  const admin = { from: () => ({ update: (u: any) => ({ eq: async () => { calls.push(u); } }) }) };
  await recordProofView(admin, { id: "p", view_count: 2, first_viewed_at: "2026-11-01T00:00:00Z" }, iphone);
  t(calls.length === 1 && calls[0].view_count === 3 && calls[0].first_viewed_at === "2026-11-01T00:00:00Z", "a real view bumps the count and keeps the first-viewed time");
  await recordProofView(admin, { id: "p" }, "Googlebot");
  t(calls.length === 1, "a bot view records nothing");
  process.exit(bad ? 1 : 0);
})();
