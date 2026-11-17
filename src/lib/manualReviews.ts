// Reviews the admin types in by hand (e.g. copied from Facebook) and edits
// to existing reviews. The date is stored in created_at, which is also what
// the public section sorts by.

export type ManualReviewInput = { name: string; rating: number; text: string; productLabel: string; date: string };

// "2026-11-03" -> a timestamp at midday UTC, which is the same calendar day
// in Eastern time year-round.
export function reviewDateToIso(date: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const d = new Date(`${date}T17:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== date) return null;
  if (d.getTime() > Date.now() + 36 * 3600 * 1000) return null; // not in the future
  return d.toISOString();
}

export function reviewDateDisplay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric" });
}

export function reviewDateInputValue(iso: string): string {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
  return p; // en-CA formats as YYYY-MM-DD
}

export function validateManualReview(raw: any): { ok: true; value: ManualReviewInput & { iso: string } } | { ok: false; error: string } {
  const name = String(raw?.name ?? "").trim().slice(0, 80);
  const text = String(raw?.text ?? "").trim().slice(0, 2000);
  const productLabel = String(raw?.productLabel ?? "").trim().slice(0, 100);
  const rating = Math.round(Number(raw?.rating));
  const date = String(raw?.date ?? "");
  if (!name) return { ok: false, error: "Enter the reviewer's name." };
  if (!(rating >= 1 && rating <= 5)) return { ok: false, error: "Choose 1 to 5 stars." };
  if (!text) return { ok: false, error: "Paste the review text." };
  const iso = reviewDateToIso(date);
  if (!iso) return { ok: false, error: "Enter a valid date (not in the future)." };
  return { ok: true, value: { name, rating, text, productLabel, date, iso } };
}
