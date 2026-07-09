import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendInvoiceEmail } from "@/lib/email";
import { productLabel, ProductType } from "@/lib/statusSteps";

const SALES_TAX_RATE = 0.06; // Michigan
const WALNUT = rgb(0.24, 0.17, 0.12);
const CREAM = rgb(0.97, 0.945, 0.9);
const EMBER = rgb(0.85, 0.376, 0.227);
const GRAY = rgb(0.4, 0.4, 0.4);
const LIGHT_LINE = rgb(0.85, 0.85, 0.85);

async function buildInvoicePdf(opts: {
  invoiceNumber: number;
  invoiceDate: Date;
  customerName: string;
  itemDescription: string;
  totalCents: number;
  paidCents: number;
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
  page.drawText("INVOICE", { x: 40, y, size: 22, font: bold, color: WALNUT });

  const total = opts.totalCents / 100;
  const paid = opts.paidCents / 100;
  const due = total - paid;
  const subtotal = total / (1 + SALES_TAX_RATE);
  const tax = total - subtotal;

  const metaX = width - 220;
  function metaRow(label: string, value: string, yy: number) {
    page.drawText(label, { x: metaX, y: yy, size: 10, font: bold, color: GRAY });
    page.drawText(value, { x: metaX + 110, y: yy, size: 10, font, color: WALNUT });
  }
  let metaY = height - 100;
  metaRow("Invoice Number:", String(opts.invoiceNumber), metaY); metaY -= 16;
  metaRow("Invoice Date:", opts.invoiceDate.toLocaleDateString("en-US", { timeZone: "America/New_York", year: "numeric", month: "long", day: "numeric" }), metaY); metaY -= 16;
  metaRow("Amount Due:", `$${due.toFixed(2)}`, metaY);

  y -= 30;
  page.drawText("BILL TO", { x: 40, y, size: 9, font: bold, color: GRAY });
  y -= 16;
  page.drawText(opts.customerName, { x: 40, y, size: 12, font: bold, color: WALNUT });
  y -= 40;

  const col = { desc: 40, qty: 340, price: 400, amount: 480 };
  page.drawLine({ start: { x: 40, y: y + 14 }, end: { x: width - 40, y: y + 14 }, thickness: 1, color: LIGHT_LINE });
  page.drawText("Item", { x: col.desc, y, size: 9, font: bold, color: WALNUT });
  page.drawText("Qty", { x: col.qty, y, size: 9, font: bold, color: WALNUT });
  page.drawText("Price", { x: col.price, y, size: 9, font: bold, color: WALNUT });
  page.drawText("Amount", { x: col.amount, y, size: 9, font: bold, color: WALNUT });
  y -= 10;
  page.drawLine({ start: { x: 40, y }, end: { x: width - 40, y }, thickness: 1, color: LIGHT_LINE });
  y -= 20;

  page.drawText(opts.itemDescription, { x: col.desc, y, size: 10, font, color: WALNUT });
  page.drawText("1", { x: col.qty, y, size: 10, font, color: WALNUT });
  page.drawText(`$${subtotal.toFixed(2)}`, { x: col.price, y, size: 10, font, color: WALNUT });
  page.drawText(`$${subtotal.toFixed(2)}`, { x: col.amount, y, size: 10, font, color: WALNUT });
  y -= 30;

  page.drawLine({ start: { x: 300, y: y + 14 }, end: { x: width - 40, y: y + 14 }, thickness: 1, color: LIGHT_LINE });

  function totalsRow(label: string, value: string, yy: number, big?: boolean) {
    page.drawText(label, { x: 380, y: yy, size: big ? 11 : 10, font: big ? bold : font, color: big ? EMBER : WALNUT });
    page.drawText(value, { x: col.amount, y: yy, size: big ? 11 : 10, font: big ? bold : font, color: big ? EMBER : WALNUT });
  }
  totalsRow("Subtotal:", `$${subtotal.toFixed(2)}`, y); y -= 18;
  totalsRow("Sales Tax (6%):", `$${tax.toFixed(2)}`, y); y -= 18;
  page.drawLine({ start: { x: 300, y: y + 12 }, end: { x: width - 40, y: y + 12 }, thickness: 1, color: WALNUT });
  totalsRow("Total:", `$${total.toFixed(2)}`, y, true); y -= 24;
  totalsRow("Amount paid:", `$${paid.toFixed(2)}`, y); y -= 18;
  totalsRow("Amount Due:", `$${due.toFixed(2)}`, y, true);
  y -= 50;

  page.drawText("Notes", { x: 40, y, size: 9, font: bold, color: GRAY });
  y -= 16;
  page.drawText("Thanks for your business!", { x: 40, y, size: 10, font, color: WALNUT });
  y -= 14;
  page.drawText("Sales tax collected in accordance with Michigan law.", { x: 40, y, size: 10, font, color: WALNUT });

  const bytes = await doc.save();
  return Buffer.from(bytes);
}

// Call this whenever an order's payment changes, or when it's marked
// "picked_up" — each call generates and emails a fresh invoice reflecting
// the current total, amount paid, and balance due at that moment.
export async function issueInvoiceForOrder(order: any, customer: { email: string; full_name: string }) {
  const admin = createAdminClient();

  const { data: numberData, error: numberError } = await admin.rpc("next_invoice_number");
  if (numberError || !numberData) {
    console.error("Couldn't get next invoice number:", numberError?.message);
    return;
  }
  const invoiceNumber = numberData as number;

  const itemDescription = `${productLabel(order.product_type as ProductType)} — ${order.title}`;

  const pdfBuffer = await buildInvoicePdf({
    invoiceNumber,
    invoiceDate: new Date(),
    customerName: customer.full_name,
    itemDescription,
    totalCents: order.price_cents || 0,
    paidCents: order.amount_paid_cents || 0
  });

  const filename = `invoice-${invoiceNumber}-${order.id}.pdf`;
  const { error: uploadError } = await admin.storage
    .from("invoices")
    .upload(filename, pdfBuffer, { contentType: "application/pdf", upsert: true });

  let pdfUrl: string | null = null;
  if (!uploadError) {
    const { data: publicUrlData } = admin.storage.from("invoices").getPublicUrl(filename);
    pdfUrl = publicUrlData.publicUrl;
  } else {
    console.error("Invoice storage upload failed:", uploadError.message);
  }

  const dueCents = (order.price_cents || 0) - (order.amount_paid_cents || 0);
  const paidInFull = dueCents <= 0;

  await admin.from("invoices").insert({
    order_id: order.id,
    invoice_number: invoiceNumber,
    pdf_url: pdfUrl,
    paid_in_full: paidInFull
  });

  try {
    await sendInvoiceEmail({
      toEmail: customer.email,
      customerName: customer.full_name,
      orderTitle: order.title,
      paidInFull,
      invoiceNumber,
      pdfBuffer
    });
    await admin.from("invoices").update({ sent_at: new Date().toISOString() }).eq("invoice_number", invoiceNumber);
  } catch (err) {
    console.error("Invoice email failed to send:", err);
  }
}
