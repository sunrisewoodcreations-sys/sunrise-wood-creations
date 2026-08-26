// Small, safe wrapper around gtag's event call — every CTA on the site
// calls this instead of gtag directly, so instrumentation works today
// (calls happily no-op) and starts actually reporting the moment a
// real GA4 measurement ID is configured, with zero code changes needed
// at the call sites later.
//
// Deliberately takes only a flat, non-identifying set of parameters —
// never pass a name, email, phone number, or order details into this.
// Event names and params below are the ones GA4 itself treats as
// "recommended events" where applicable (e.g. click), which is what
// makes them show up cleanly in GA4's own reports rather than only as
// generic custom events.
export function trackEvent(eventName: string, params?: Record<string, string | number | boolean>) {
  if (typeof window === "undefined") return;
  const gtag = (window as any).gtag;
  if (typeof gtag !== "function") return;
  gtag("event", eventName, params || {});
}
