// Tracking whether the customer has opened a design proof.
// Email security scanners and link-preview bots often "open" links before
// the person does, so obvious bots are ignored, and so is you previewing the
// page while signed in as admin. Any other real browser opening the page
// counts as viewed, even for a second.

const BOT_RE = /bot|crawl|spider|preview|scan|fetch|monitor|slurp|facebookexternalhit|whatsapp|googleimageproxy|google-pixel|headless|curl|wget|python|node-fetch|go-http|java\//i;

export function isLikelyBot(userAgent: string | null | undefined): boolean {
  if (!userAgent) return true; // real browsers always send one
  return BOT_RE.test(userAgent);
}

export async function recordProofView(
  admin: any,
  proof: { id: string; view_count?: number | null; first_viewed_at?: string | null },
  userAgent: string | null | undefined
): Promise<void> {
  if (isLikelyBot(userAgent)) return;
  const now = new Date().toISOString();
  await admin.from("proofs").update({
    first_viewed_at: proof.first_viewed_at || now,
    last_viewed_at: now,
    view_count: (proof.view_count || 0) + 1
  }).eq("id", proof.id);
}

// For the admin screens: a short plain-English line.
export function proofViewedLabel(p: { first_viewed_at?: string | null; last_viewed_at?: string | null; view_count?: number | null }): string {
  if (!p.first_viewed_at) return "Not viewed yet";
  const when = new Date(p.last_viewed_at || p.first_viewed_at).toLocaleString("en-US", {
    timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit"
  });
  const n = p.view_count || 1;
  return `Viewed ${when} ET${n > 1 ? ` · ${n} views` : ""}`;
}
