import { salesTaxOwedCents, revenueExcludingTaxCents } from "../src/lib/tax";
import { buildInvoicePdf } from "../src/lib/invoice";
import { DEFAULT_INVOICE_SETTINGS } from "../src/lib/invoiceSettings";

let bad = 0;
const t = (ok: boolean, m: string) => { if (!ok) { bad++; console.log("FAIL", m); } else console.log("ok  ", m); };

// $300 board (taxed) + $20 design fee (no tax) = $320 total. Tax only on the $300.
const tax = Math.round(salesTaxOwedCents(32000, 2000));
t(tax === 1698, `tax owed on 300 taxed + 20 exempt = ${tax} (expect 1698)`);
t(Math.round(revenueExcludingTaxCents(32000, 2000)) === 32000 - 1698, "revenue excluding tax");
t(Math.round(salesTaxOwedCents(32000, 0)) === 1811, "no exempt lines: tax on all 320");
t(salesTaxOwedCents(2000, 5000) === 0, "exempt more than revenue never goes negative");

(async () => {
  const pdf = await buildInvoicePdf({
    invoiceNumber: 1100, invoiceYear: 2026, invoiceDate: new Date(), dueDate: null, customerName: "Test", customerEmail: "t@e.com",
    lineItems: [
      { description: "Cornhole boards", quantity: 1, lineTotalCents: 30000, unitPriceCentsInclusive: 30000 },
      { description: "Design service (no sales tax)", quantity: 1, lineTotalCents: 2000, unitPriceCentsInclusive: 2000, taxExempt: true }
    ] as any,
    totalCents: 32000, paidCents: 0, paymentMethod: null, paymentReference: null,
    contactPhone: "1", contactEmail: "a@b.c", settings: DEFAULT_INVOICE_SETTINGS
  } as any);
  t(pdf.length > 1000, "invoice with a no-tax line builds");
  require("fs").writeFileSync("/home/claude/work/out/tax-exempt-invoice.pdf", pdf);
  process.exit(bad ? 1 : 0);
})();
