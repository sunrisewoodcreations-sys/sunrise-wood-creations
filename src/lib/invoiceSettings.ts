// Invoice settings the admin can change: which payment methods are
// accepted, free-text payment instructions, and default payment terms.
// Stored inside the existing site_settings row (data.invoice), so no
// database change is needed, and read by the invoice PDF generator.

export const PAYMENT_METHOD_OPTIONS = [
  { key: "cash", label: "Cash" },
  { key: "check", label: "Check" },
  { key: "card", label: "Credit/Debit Card" },
  { key: "venmo", label: "Venmo" },
  { key: "zelle", label: "Zelle" }
] as const;

export const PAYMENT_METHOD_LABELS: Record<string, string> = Object.fromEntries(
  PAYMENT_METHOD_OPTIONS.map(m => [m.key, m.label])
);

// null = no default terms (the invoice behaves exactly as it always has).
// 0 = due on receipt, otherwise "Net N" days from the invoice date.
export const TERMS_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: "No default terms" },
  { value: 0, label: "Due on receipt" },
  { value: 7, label: "Net 7 (7 days)" },
  { value: 14, label: "Net 14 (14 days)" },
  { value: 15, label: "Net 15 (15 days)" },
  { value: 30, label: "Net 30 (30 days)" }
];

export const MAX_INSTRUCTIONS_LENGTH = 350;

export interface InvoiceSettings {
  paymentMethods: string[];
  paymentInstructions: string;
  termsDays: number | null;
}

export const DEFAULT_INVOICE_SETTINGS: InvoiceSettings = {
  paymentMethods: [],
  paymentInstructions: "",
  termsDays: null
};

// Accepts anything (a saved row, a request body) and returns a clean,
// safe settings object — unknown methods dropped, text trimmed/capped.
export function normalizeInvoiceSettings(raw: any): InvoiceSettings {
  const valid = new Set(PAYMENT_METHOD_OPTIONS.map(m => m.key as string));
  const methods = Array.isArray(raw?.paymentMethods)
    ? PAYMENT_METHOD_OPTIONS.map(m => m.key as string).filter(k => raw.paymentMethods.includes(k) && valid.has(k))
    : [];
  const instructions = typeof raw?.paymentInstructions === "string"
    ? raw.paymentInstructions.replace(/\r\n/g, "\n").trim().slice(0, MAX_INSTRUCTIONS_LENGTH)
    : "";
  const t = raw?.termsDays;
  const termsDays = typeof t === "number" && [0, 7, 14, 15, 30].includes(t) ? t : null;
  return { paymentMethods: methods, paymentInstructions: instructions, termsDays };
}

export function termsLabel(termsDays: number | null): string | null {
  if (termsDays === null) return null;
  return termsDays === 0 ? "Due on Receipt" : `Net ${termsDays}`;
}

// "YYYY-MM-DD" for a moment in Eastern time (this app's calendar).
export function easternDateString(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

function dayNumber(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
}

// The due date the invoice shows. The order's own due date always wins
// (existing behavior); only when the order has none AND default terms are
// set is one worked out from the invoice date.
export function resolveDueDate(orderDueDate: string | null | undefined, invoiceDate: Date, termsDays: number | null): string | null {
  if (orderDueDate) return orderDueDate;
  if (termsDays === null) return null;
  const base = dayNumber(easternDateString(invoiceDate)) + termsDays;
  const dt = new Date(base * 86400000);
  return dt.toISOString().slice(0, 10);
}

// Whole days past the due date (0 if not overdue). Only unpaid balances
// can be overdue; a due date of today is not yet overdue.
export function daysOverdue(dueYmd: string | null, balanceCents: number, now: Date = new Date()): number {
  if (!dueYmd || balanceCents <= 0) return 0;
  const diff = dayNumber(easternDateString(now)) - dayNumber(dueYmd);
  return diff > 0 ? diff : 0;
}
