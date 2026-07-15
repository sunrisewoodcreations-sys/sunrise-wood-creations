// Single source of truth for displaying a stored "YYYY-MM-DD" calendar
// date (due_date, etc.) anywhere in the app — admin pages, customer
// pages, emails, PDFs, all of it.
//
// The bug this fixes: due_date is stored as a plain calendar date with
// no time or timezone attached. The old pattern — new Date(due_date +
// "T00:00:00") — asks JavaScript to interpret that string using
// whatever timezone the CODE HAPPENS TO BE RUNNING IN. That's fine and
// invisible on a page that renders entirely in the browser (creation
// and display use the same local zone, so it cancels out) — but it
// silently breaks on a page that's server-rendered (Vercel's servers
// run in UTC) and then explicitly formatted with `timeZone:
// "America/New_York"` for display: the date gets parsed as UTC
// midnight, then converted "back" to Eastern for display, which lands
// on the previous evening — one day early.
//
// The fix: never let a due_date round-trip through a real timezone at
// all. Parse the Y/M/D digits directly, build the Date at UTC using
// those exact digits, and always format using timeZone: "UTC". Creation
// and display then always agree, no matter what timezone the server or
// the visitor's browser happens to be in.
export function formatCalendarDate(
  dateStr: string,
  style: "short" | "long" = "short"
): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (style === "long") {
    return date.toLocaleDateString("en-US", { timeZone: "UTC", month: "long", day: "numeric", year: "numeric" });
  }
  return date.toLocaleDateString("en-US", { timeZone: "UTC", month: "numeric", day: "numeric", year: "numeric" });
}
