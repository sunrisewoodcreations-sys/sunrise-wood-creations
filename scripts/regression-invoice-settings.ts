import { normalizeInvoiceSettings, resolveDueDate, daysOverdue, termsLabel } from "../src/lib/invoiceSettings";
let bad = 0;
const t = (ok: boolean, m: string) => { if (!ok) bad++; console.log((ok ? "PASS " : "FAIL ") + m); };

const n = normalizeInvoiceSettings({ paymentMethods: ["zelle", "bogus", "cash", "cash"], paymentInstructions: "  hi\r\nthere  ", termsDays: 15 });
t(JSON.stringify(n.paymentMethods) === '["cash","zelle"]', "unknown methods dropped, order fixed, no duplicates");
t(n.paymentInstructions === "hi\nthere", "instructions trimmed and line breaks normalized");
t(n.termsDays === 15, "valid terms kept");
t(normalizeInvoiceSettings({ termsDays: 12 }).termsDays === null, "invalid terms become none");
t(normalizeInvoiceSettings(undefined).paymentMethods.length === 0, "missing settings = nothing shown");
t(normalizeInvoiceSettings({ paymentInstructions: "x".repeat(900) }).paymentInstructions.length === 350, "instructions capped");

t(termsLabel(null) === null && termsLabel(0) === "Due on Receipt" && termsLabel(30) === "Net 30", "terms labels");

const inv = new Date("2026-10-01T15:00:00Z");
t(resolveDueDate("2026-10-20", inv, 15) === "2026-10-20", "order's own due date always wins");
t(resolveDueDate(null, inv, null) === null, "no terms and no due date = no due date (unchanged)");
t(resolveDueDate(null, inv, 15) === "2026-10-16", "Net 15 from invoice date");
t(resolveDueDate(null, inv, 0) === "2026-10-01", "due on receipt = invoice date");
t(resolveDueDate(null, new Date("2026-12-25T15:00:00Z"), 15) === "2027-01-09", "terms cross a year end");

const now = new Date("2026-11-03T15:00:00Z");
t(daysOverdue("2026-10-16", 27100, now) === 18, "18 days overdue");
t(daysOverdue("2026-11-03", 27100, now) === 0, "due today is not overdue");
t(daysOverdue("2026-11-04", 27100, now) === 0, "future due date is not overdue");
t(daysOverdue("2026-10-16", 0, now) === 0, "paid in full is never overdue");
t(daysOverdue(null, 5000, now) === 0, "no due date is never overdue");

process.exit(bad ? 1 : 0);
