import { validatePaymentInput, paymentLinesForInvoice } from "../src/lib/payments";
import { buildInvoicePdf } from "../src/lib/invoice";
import { DEFAULT_INVOICE_SETTINGS } from "../src/lib/invoiceSettings";

let bad = 0;
const t = (ok: boolean, m: string) => { if (!ok) { bad++; console.log("FAIL", m); } else console.log("ok  ", m); };

t(!validatePaymentInput({ amountCents: 0, method: "cash" }).ok, "amount is required");
t(!validatePaymentInput({ amountCents: 5000 }).ok, "method is required");
t(!validatePaymentInput({ amountCents: 5000, method: "bitcoin" }).ok, "unknown method rejected");
t(!validatePaymentInput({ amountCents: 5000, method: "venmo", reference: " " }).ok, "venmo needs a transaction number");
const v = validatePaymentInput({ amountCents: 5000.4, method: "cash", reference: "ignored" });
t(v.ok && v.value.amountCents === 5000 && v.value.reference === "", "cash payment valid, reference dropped");
const L = { venmo: "Venmo", cash: "Cash" };
const two = paymentLinesForInvoice([{ amount_cents: 10000, method: "venmo", reference: "abc123" }, { amount_cents: 20000, method: "cash", reference: null }], L);
t(two.length === 2 && two[0].label === "Venmo #abc123" && two[1].label === "Cash", "two payments make two lines");
const many = paymentLinesForInvoice([1, 2, 3, 4, 5].map(n => ({ amount_cents: n * 100, method: "cash", reference: null })), L);
t(many.length === 3 && many[2].cents === 1200, "5 payments collapse to 3 lines, total preserved");

(async () => {
  const pdf = await buildInvoicePdf({
    invoiceNumber: 1100, invoiceYear: 2026, invoiceDate: new Date(), dueDate: null, customerName: "Test", customerEmail: "t@e.com",
    lineItems: [{ description: "Board", quantity: 1, lineTotalCents: 30000, unitPriceCentsInclusive: 30000 }] as any,
    totalCents: 30000, paidCents: 30000, paymentMethod: "cash", paymentReference: null,
    payments: [{ amount_cents: 10000, method: "venmo", reference: "abc123" }, { amount_cents: 20000, method: "cash", reference: null }],
    contactPhone: "1", contactEmail: "a@b.c", settings: DEFAULT_INVOICE_SETTINGS
  } as any);
  t(pdf.length > 1000, "invoice with two payments builds");
  require("fs").writeFileSync(process.env.OUT || "/tmp/pay-invoice.pdf", pdf);
  process.exit(bad ? 1 : 0);
})();
