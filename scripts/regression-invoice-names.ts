import assert from "node:assert/strict";
import { formatOrderNumber, matchesOrderNumberQuery } from "../src/lib/orderDisplay";
import { invoiceFileName, invoiceDownloadUrl } from "../src/lib/invoiceNames";
const t = (n: string, f: () => void) => { try { f(); console.log("PASS ", n); } catch (e: any) { console.error("FAIL ", n, e.message); process.exitCode = 1; } };
t("order number with year", () => { assert.equal(formatOrderNumber(1100, false, 2026), "SWC-2026-1100"); assert.equal(formatOrderNumber(1, true, 2026), "DEMO-2026-1"); });
t("order number without year keeps old format", () => assert.equal(formatOrderNumber(1001, false), "SWC-1001"));
t("search matches many spellings", () => {
  for (const q of ["SWC-2026-1100", "swc20261100", "#2026-1100", "2026-1100", "20261100", "1100"]) assert.ok(matchesOrderNumberQuery(q, 1100, false, 2026), q);
  assert.ok(!matchesOrderNumberQuery("11", 1100, false, 2026));
});
t("invoice file name", () => assert.equal(invoiceFileName(2026, 1100, "Jane / Smith"), "Sunrise-Wood-Creations_Invoice-2026-1100_Jane-Smith.pdf"));
t("invoice file name without customer", () => assert.equal(invoiceFileName(2026, 1100, null), "Sunrise-Wood-Creations_Invoice-2026-1100.pdf"));
t("accents and punctuation", () => assert.equal(invoiceFileName(2026, 5, "  José O'Brien & Sons "), "Sunrise-Wood-Creations_Invoice-2026-5_Jose-O-Brien-Sons.pdf"));
t("download url", () => {
  const u = invoiceDownloadUrl("https://x.supabase.co/storage/v1/object/public/invoices/a.pdf", 2026, 1100, "Jane Smith");
  assert.ok(u.endsWith("?download=Sunrise-Wood-Creations_Invoice-2026-1100_Jane-Smith.pdf"));
  assert.equal(invoiceDownloadUrl(u, 2026, 1100, "Jane Smith"), u);
  assert.equal(invoiceDownloadUrl(null, 2026, 1, "x"), "");
});
