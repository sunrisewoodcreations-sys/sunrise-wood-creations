import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { createAdminClient } from "@/lib/supabase/admin";
import { calculateQuoteTotals } from "@/lib/tax";
import { formatQuoteNumber, formatQuoteNumberWithRevision } from "@/lib/quoteNumber";
export { formatQuoteNumber, formatQuoteNumberWithRevision, calculateQuoteTotals };

// Same brand colors already used for invoices, reused directly so
// quotes and invoices look like they belong to the same business.
const WALNUT = rgb(0.1176, 0.2275, 0.3725);
const CREAM = rgb(1, 1, 1);
const EMBER = rgb(0.85, 0.376, 0.227);
const GRAY = rgb(0.4, 0.4, 0.4);
const LIGHT_LINE = rgb(0.85, 0.85, 0.85);
const SAGE = rgb(0.22, 0.5, 0.34);

export type QuoteLineItem = {
  title: string;
  description?: string | null;
  quantity: number;
  unitPriceCents: number; // tax-inclusive, matching how orders/invoices already price items
};

export async function getNextQuoteNumber(currentYear: number): Promise<number> {
  // Same approach already used for invoice numbers — computed from
  // what's already in the table for this year, not a separate sequence.
  const admin = createAdminClient();
  const { data: maxRow } = await admin
    .from("quotes")
    .select("quote_number")
    .eq("quote_year", currentYear)
    .order("quote_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (maxRow?.quote_number || 99) + 1;
}

export async function buildQuotePdf(opts: {
  quoteNumber: number;
  quoteYear: number;
  revisionNumber: number;
  issueDate: string;
  expirationDate: string;
  customerName: string;
  lineItems: QuoteLineItem[];
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  deliveryCents: number;
  totalCents: number;
  notes?: string | null;
  terms?: string | null;
}): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const { width, height } = page.getSize();

  page.drawRectangle({ x: 0, y: height - 90, width, height: 90, color: WALNUT });
  page.drawText("Sunrise Wood Creations LLC", { x: 40, y: height - 45, size: 20, font: bold, color: CREAM });
  page.drawText("Lawrence, Michigan 49064  ·  United States  ·  (269) 762-1460", {
    x: 40, y: height - 68, size: 10, font, color: CREAM
  });

  let y = height - 130;
  page.drawText("QUOTE", { x: 40, y, size: 22, font: bold, color: WALNUT });
  if (opts.revisionNumber > 1) {
    page.drawText(`REVISED — Revision ${opts.revisionNumber}`, { x: 40, y: y - 18, size: 10, font: bold, color: EMBER });
  }

  const metaX = width - 230;
  function metaRow(label: string, value: string, yy: number, color?: ReturnType<typeof rgb>) {
    page.drawText(label, { x: metaX, y: yy, size: 10, font: bold, color: GRAY });
    page.drawText(value, { x: metaX + 120, y: yy, size: 10, font, color: color || WALNUT });
  }
  let metaY = height - 100;
  metaRow("Quote Number:", formatQuoteNumberWithRevision(opts.quoteYear, opts.quoteNumber, opts.revisionNumber), metaY); metaY -= 16;
  metaRow("Issue Date:", new Date(opts.issueDate + "T12:00:00Z").toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }), metaY); metaY -= 16;
  metaRow("Expires:", new Date(opts.expirationDate + "T12:00:00Z").toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }), metaY, EMBER);

  y -= 30;
  page.drawText("PREPARED FOR", { x: 40, y, size: 9, font: bold, color: GRAY });
  y -= 16;
  page.drawText(opts.customerName, { x: 40, y, size: 12, font: bold, color: WALNUT });
  y -= 40;

  const col = { desc: 40, qty: 340, price: 400, amount: 480 };
  page.drawLine({ start: { x: 40, y: y + 14 }, end: { x: width - 40, y: y + 14 }, thickness: 1, color: LIGHT_LINE });
  page.drawText("Item", { x: col.desc, y, size: 9, font: bold, color: WALNUT });
  page.drawText("Qty", { x: col.qty, y, size: 9, font: bold, color: WALNUT });
  page.drawText("Unit Price", { x: col.price, y, size: 9, font: bold, color: WALNUT });
  page.drawText("Amount", { x: col.amount, y, size: 9, font: bold, color: WALNUT });
  y -= 10;
  page.drawLine({ start: { x: 40, y }, end: { x: width - 40, y }, thickness: 1, color: LIGHT_LINE });
  y -= 20;

  for (const item of opts.lineItems) {
    const qty = Math.max(1, item.quantity || 1);
    const lineTotal = (item.unitPriceCents * qty) / 100;
    page.drawText(item.title.slice(0, 46), { x: col.desc, y, size: 10, font, color: WALNUT });
    page.drawText(String(qty), { x: col.qty, y, size: 10, font, color: WALNUT });
    page.drawText(`$${(item.unitPriceCents / 100).toFixed(2)}`, { x: col.price, y, size: 10, font, color: WALNUT });
    page.drawText(`$${lineTotal.toFixed(2)}`, { x: col.amount, y, size: 10, font, color: WALNUT });
    y -= 18;
    if (item.description) {
      page.drawText(item.description.slice(0, 80), { x: col.desc, y, size: 8, font, color: GRAY });
      y -= 16;
    }
  }

  y -= 10;
  page.drawLine({ start: { x: 300, y: y + 10 }, end: { x: width - 40, y: y + 10 }, thickness: 1, color: LIGHT_LINE });

  function totalsRow(label: string, cents: number, yy: number, bold_: boolean, color?: ReturnType<typeof rgb>) {
    page.drawText(label, { x: 380, y: yy, size: bold_ ? 11 : 10, font: bold_ ? bold : font, color: color || WALNUT });
    page.drawText(`$${(cents / 100).toFixed(2)}`, { x: col.amount, y: yy, size: bold_ ? 11 : 10, font: bold_ ? bold : font, color: color || WALNUT });
  }
  totalsRow("Subtotal", opts.subtotalCents, y, false); y -= 16;
  if (opts.discountCents > 0) { totalsRow("Discount", -opts.discountCents, y, false, EMBER); y -= 16; }
  totalsRow("Tax", opts.taxCents, y, false); y -= 16;
  if (opts.deliveryCents > 0) { totalsRow("Delivery", opts.deliveryCents, y, false); y -= 16; }
  y -= 4;
  page.drawLine({ start: { x: 300, y: y + 12 }, end: { x: width - 40, y: y + 12 }, thickness: 1, color: WALNUT });
  totalsRow("Total", opts.totalCents, y, true, SAGE);
  y -= 50;

  if (opts.notes) {
    page.drawText("NOTES", { x: 40, y, size: 9, font: bold, color: GRAY });
    y -= 16;
    page.drawText(opts.notes.slice(0, 100), { x: 40, y, size: 10, font, color: WALNUT });
    y -= 30;
  }

  page.drawText("TERMS & CONDITIONS", { x: 40, y, size: 9, font: bold, color: GRAY });
  y -= 16;
  const terms = opts.terms || "This quote is valid until the expiration date shown above. Prices are subject to change after expiration. A deposit may be required to begin production.";
  const words = terms.split(" ");
  let line = "";
  for (const word of words) {
    if ((line + word).length > 95) {
      page.drawText(line, { x: 40, y, size: 9, font, color: GRAY });
      y -= 13;
      line = "";
    }
    line += word + " ";
  }
  if (line) { page.drawText(line, { x: 40, y, size: 9, font, color: GRAY }); y -= 13; }

  y -= 40;
  page.drawLine({ start: { x: 40, y }, end: { x: 260, y }, thickness: 1, color: WALNUT });
  page.drawText("Customer Approval", { x: 40, y: y - 14, size: 9, font, color: GRAY });
  page.drawLine({ start: { x: 320, y }, end: { x: 440, y }, thickness: 1, color: WALNUT });
  page.drawText("Date", { x: 320, y: y - 14, size: 9, font, color: GRAY });

  const pdfBytes = await doc.save();
  return Buffer.from(pdfBytes);
}

// Copies every line item from one quote to another — the one piece of
// logic genuinely identical between "Duplicate" and "create a new
// revision", extracted so neither has its own copy of it.
export async function copyQuoteItemsTo(admin: ReturnType<typeof createAdminClient>, sourceQuoteId: string, targetQuoteId: string): Promise<void> {
  const { data: sourceItems } = await admin
    .from("quote_items")
    .select("*")
    .eq("quote_id", sourceQuoteId)
    .order("sort_order", { ascending: true });

  if (!sourceItems || sourceItems.length === 0) return;

  const itemRows = sourceItems.map((it: any) => ({
    quote_id: targetQuoteId,
    product_id: it.product_id,
    title: it.title,
    description: it.description,
    quantity: it.quantity,
    unit_price_cents: it.unit_price_cents,
    sort_order: it.sort_order
  }));
  await admin.from("quote_items").insert(itemRows);
}
