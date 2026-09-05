import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fs from "fs";
import path from "path";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendInvoiceEmail, sendLowStockAlert } from "@/lib/email";
import { shouldNotify } from "@/lib/notify";
import { productLabel, ProductType } from "@/lib/statusSteps";
import { SALES_TAX_RATE } from "@/lib/tax";

// Same brand palette already used in the redesigned customer emails —
// kept as the single source of truth for both, rather than a separate
// invoice-only color set that could drift out of sync.
const WALNUT = rgb(0.1176, 0.2275, 0.3725); // #1E3A5F
const WALNUT_DARK = rgb(0.239, 0.169, 0.122); // #3D2B1F
const CREAM = rgb(0.969, 0.945, 0.902); // #F7F1E6
const WHITE = rgb(1, 1, 1);
const EMBER = rgb(0.851, 0.376, 0.227); // #D9603A
const SAGE = rgb(0.310, 0.478, 0.333); // #4F7A55
const GRAY = rgb(0.42, 0.365, 0.306); // muted warm gray, matches email footer text
const MUTED_TAN = rgb(0.66, 0.588, 0.518); // matches email's muted #a89684
const LIGHT_LINE = rgb(0.898, 0.851, 0.765); // matches email's card border #e5d9c3
const ROW_SHADE = rgb(0.988, 0.965, 0.918); // very light cream for zebra striping

// Same fallback values already used in email.ts if the live site_settings
// read fails for any reason — never a second, different hardcoded copy.
const DEFAULT_CONTACT_PHONE = "(269) 762-1460";
const DEFAULT_CONTACT_EMAIL = "sunrisewoodcreations@gmail.com";

// Same idea as email.ts's getContactInfo() — reads the real, existing
// business contact info from site_settings (the same source the website
// footer and emails already use) instead of a hardcoded literal.
async function getInvoiceContactInfo(admin: ReturnType<typeof createAdminClient>): Promise<{ phone: string; email: string }> {
  try {
    const { data } = await admin.from("site_settings").select("data").eq("id", 1).single();
    const contact = (data?.data as any)?.contact;
    if (contact?.phone && contact?.email) {
      return { phone: contact.phone, email: contact.email };
    }
  } catch {
    // Fall through to the defaults below.
  }
  return { phone: DEFAULT_CONTACT_PHONE, email: DEFAULT_CONTACT_EMAIL };
}

// Single source of truth for displaying an invoice number as
// "YYYY-NNNN" — used everywhere an invoice number is shown, so the
// format only ever needs to change in one place.
export function formatInvoiceNumber(year: number, number: number): string {
  return `${year}-${number}`;
}

type InvoiceLineItem = {
  description: string;
  quantity: number;
  lineTotalCents: number; // this item's share of the tax-inclusive total
};

// Checks one product's stock against its own threshold, and sends a
// warning email the first time it dips at or below that line. Won't send
// again for the same dip — the alert flag only resets when someone
// manually restocks it back above the threshold (see the products PATCH route).
async function checkAndSendLowStockAlert(admin: ReturnType<typeof createAdminClient>, productId: string) {
  const { data: product } = await admin
    .from("products")
    .select("name, stock_quantity, low_stock_threshold, low_stock_alert_sent")
    .eq("id", productId)
    .maybeSingle();

  if (!product) return;
  const stock = product.stock_quantity || 0;
  const threshold = product.low_stock_threshold || 0;

  if (stock <= threshold && !product.low_stock_alert_sent) {
    try {
      await sendLowStockAlert({ productName: product.name, remainingStock: stock, threshold });
      await admin.from("products").update({ low_stock_alert_sent: true }).eq("id", productId);
    } catch (err) {
      console.error("Low-stock alert failed to send:", err);
    }
  }
}

async function buildInvoicePdf(opts: {
  invoiceNumber: number;
  invoiceYear: number;
  invoiceDate: Date;
  customerName: string;
  customerEmail?: string;
  lineItems: InvoiceLineItem[];
  totalCents: number;
  paidCents: number;
  contactPhone: string;
  contactEmail: string;
}): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  // Serif for headings only (business name, "INVOICE", section labels) —
  // echoes the Georgia serif used for headings in the redesigned customer
  // emails, while body/data text stays on the clean Helvetica already used
  // here, for readability.
  const serif = await doc.embedFont(StandardFonts.TimesRomanBold);
  const { width, height } = page.getSize();
  const marginX = 40;
  const rightEdge = width - marginX;

  function rightAlignedText(text: string, rightX: number, y: number, size: number, useFont: typeof font, color: ReturnType<typeof rgb>) {
    const w = useFont.widthOfTextAtSize(text, size);
    page.drawText(text, { x: rightX - w, y, size, font: useFont, color });
  }

  function formatCurrency(cents: number): string {
    return cents < 0 ? `-$${Math.abs(cents / 100).toFixed(2)}` : `$${(cents / 100).toFixed(2)}`;
  }

  // Simple word-wrap capped at 2 lines, with an ellipsis if a description
  // still doesn't fit — so a long product/order title never overruns the
  // Qty/Price/Amount columns to its right.
  function wrapText(text: string, maxWidth: number, useFont: typeof font, size: number, maxLines = 2): string[] {
    const words = text.split(" ");
    const lines: string[] = [];
    let current = "";
    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      if (!current || useFont.widthOfTextAtSize(test, size) <= maxWidth) {
        current = test;
      } else {
        lines.push(current);
        current = word;
        if (lines.length === maxLines) break;
      }
    }
    if (lines.length < maxLines && current) lines.push(current);
    const consumedWords = lines.join(" ").split(" ").length;
    if (consumedWords < words.length && lines.length >= maxLines) {
      let lastLine = lines[maxLines - 1];
      while (lastLine.length > 0 && useFont.widthOfTextAtSize(lastLine + "…", size) > maxWidth) {
        lastLine = lastLine.slice(0, -1);
      }
      lines[maxLines - 1] = lastLine + "…";
    }
    return lines.slice(0, maxLines);
  }

  // ===== HEADER =====
  const headerHeight = 104;
  page.drawRectangle({ x: 0, y: height - headerHeight, width, height: headerHeight, color: WALNUT_DARK });
  page.drawRectangle({ x: 0, y: height - headerHeight - 3, width, height: 3, color: EMBER });

  let logoWidth = 0;
  try {
    const logoBytes = fs.readFileSync(path.join(process.cwd(), "public", "logo-header.png"));
    const logoImage = await doc.embedPng(logoBytes);
    const logoHeight = 52;
    logoWidth = (logoImage.width / logoImage.height) * logoHeight;
    page.drawImage(logoImage, { x: marginX, y: height - headerHeight / 2 - logoHeight / 2, width: logoWidth, height: logoHeight });
  } catch {
    // Logo is a nice-to-have here — if it's ever missing, the invoice
    // still generates correctly with just the business name as text.
  }

  const textX = marginX + logoWidth + (logoWidth > 0 ? 18 : 0);
  page.drawText("Sunrise Wood Creations LLC", { x: textX, y: height - 46, size: 17, font: serif, color: WHITE });
  page.drawText(`Lawrence, Michigan  ·  ${opts.contactPhone}`, { x: textX, y: height - 65, size: 9.5, font, color: CREAM });
  page.drawText(opts.contactEmail, { x: textX, y: height - 80, size: 9.5, font, color: CREAM });

  // ===== INVOICE HEADING + META =====
  let y = height - headerHeight - 44;
  page.drawText("INVOICE", { x: marginX, y, size: 24, font: serif, color: WALNUT });

  const total = opts.totalCents / 100;
  const paid = opts.paidCents / 100;
  const due = total - paid;
  const isPaidInFull = due <= 0;

  const metaLabelX = width - 210;
  const metaValueRight = rightEdge;
  function metaRow(label: string, value: string, yy: number, color?: ReturnType<typeof rgb>, valueBold?: boolean) {
    page.drawText(label, { x: metaLabelX, y: yy, size: 9.5, font: bold, color: GRAY });
    rightAlignedText(value, metaValueRight, yy, 10.5, valueBold ? bold : font, color || WALNUT);
  }
  let metaY = height - headerHeight - 22;
  metaRow("Invoice #", formatInvoiceNumber(opts.invoiceYear, opts.invoiceNumber), metaY); metaY -= 17;
  metaRow(
    "Invoice Date",
    opts.invoiceDate.toLocaleDateString("en-US", { timeZone: "America/New_York", year: "numeric", month: "long", day: "numeric" }),
    metaY
  ); metaY -= 17;
  metaRow("Status", isPaidInFull ? "Paid in Full" : "Balance Due", metaY, isPaidInFull ? SAGE : EMBER, true);

  // ===== BILL TO =====
  y -= 50;
  page.drawText("BILL TO", { x: marginX, y, size: 9, font: bold, color: GRAY });
  y -= 18;
  page.drawText(opts.customerName, { x: marginX, y, size: 13, font: bold, color: WALNUT });
  if (opts.customerEmail) {
    y -= 16;
    page.drawText(opts.customerEmail, { x: marginX, y, size: 10, font, color: GRAY });
  }
  y -= 46;

  // ===== LINE ITEMS TABLE =====
  const col = { descRight: 330, qtyRight: 400, priceRight: 480, amountRight: rightEdge };
  const rowPaddingV = 14;
  const lineHeight = 13;
  const bodySize = 10;

  page.drawRectangle({ x: marginX, y: y - 8, width: rightEdge - marginX, height: 28, color: CREAM });
  const headerTextY = y + 2;
  page.drawText("ITEM", { x: marginX + 8, y: headerTextY, size: 9, font: bold, color: WALNUT });
  rightAlignedText("QTY", col.qtyRight, headerTextY, 9, bold, WALNUT);
  rightAlignedText("PRICE", col.priceRight, headerTextY, 9, bold, WALNUT);
  rightAlignedText("AMOUNT", col.amountRight - 8, headerTextY, 9, bold, WALNUT);
  y -= 28;

  function formatCurrencyLocal(cents: number): string {
    return formatCurrency(cents);
  }

  let subtotal = 0;
  const descMaxWidth = col.descRight - (marginX + 8) - 10;
  // Reserves enough room below for the totals box + notes card + footer
  // (roughly 300pt) so a long item list can never run into them. The
  // original had an equivalent single-page cap ("if (y < 140) break")
  // sized for its shorter totals section — this is the same safeguard,
  // recalibrated for the new, taller totals/notes sections.
  const minYForItems = 350;
  let itemsShown = 0;
  for (const item of opts.lineItems) {
    const qty = Math.max(1, item.quantity || 1);
    const lineSubtotal = (item.lineTotalCents / 100) / (1 + SALES_TAX_RATE);
    const unitSubtotal = lineSubtotal / qty;

    const wrapped = wrapText(item.description, descMaxWidth, font, bodySize);
    const rowHeight = Math.max(1, wrapped.length) * lineHeight + rowPaddingV;

    if (y - rowHeight < minYForItems && itemsShown > 0) break;

    subtotal += lineSubtotal;

    if (itemsShown % 2 === 1) {
      page.drawRectangle({ x: marginX, y: y - rowHeight + rowPaddingV - 4, width: rightEdge - marginX, height: rowHeight, color: ROW_SHADE });
    }

    const firstLineY = y - 6;
    wrapped.forEach((line, i) => {
      page.drawText(line, { x: marginX + 8, y: firstLineY - i * lineHeight, size: bodySize, font, color: WALNUT });
    });
    rightAlignedText(String(qty), col.qtyRight, firstLineY, bodySize, font, WALNUT);
    rightAlignedText(formatCurrencyLocal(unitSubtotal * 100), col.priceRight, firstLineY, bodySize, font, WALNUT);
    rightAlignedText(formatCurrencyLocal(lineSubtotal * 100), col.amountRight - 8, firstLineY, bodySize, font, WALNUT);

    y -= rowHeight;
    itemsShown++;
  }

  if (itemsShown < opts.lineItems.length) {
    const remaining = opts.lineItems.length - itemsShown;
    // Recompute the true subtotal from every item, not just the ones
    // shown, so the totals below are always correct even if the list
    // had to be cut short — the same principle as the original's
    // calculation, just guarded against this edge case.
    subtotal = opts.lineItems.reduce((sum, it) => sum + (it.lineTotalCents / 100) / (1 + SALES_TAX_RATE), 0);
    page.drawText(`+ ${remaining} more item${remaining === 1 ? "" : "s"} — see full order details`, {
      x: marginX + 8, y: y - 8, size: 9, font, color: GRAY
    });
    y -= 20;
  }

  page.drawLine({ start: { x: marginX, y: y + 4 }, end: { x: rightEdge, y: y + 4 }, thickness: 1, color: LIGHT_LINE });

  const tax = total - subtotal;

  // ===== TOTALS BOX =====
  // Taller rows than before, both for the "much more visually prominent"
  // requirement and to help the page feel balanced rather than sparse.
  y -= 26;
  const totalsBoxWidth = 260;
  const totalsBoxX = rightEdge - totalsBoxWidth;
  const totalsRowH = 24;
  const dueBoxHeight = 34;
  const dueGap = 10;
  // 4 plain rows (Subtotal, Tax, Total, Amount Paid) plus the separate
  // Amount Due band below them, sized to actually contain both — computed
  // directly, rather than reusing the same running "ty" cursor for the
  // due band, which is what caused it to overlap Amount Paid before.
  const totalsBoxHeight = totalsRowH * 4 + 16 + dueGap + dueBoxHeight;
  page.drawRectangle({ x: totalsBoxX, y: y - totalsBoxHeight + totalsRowH, width: totalsBoxWidth, height: totalsBoxHeight, color: CREAM });

  let ty = y;
  function totalsRow(label: string, value: string, big?: boolean, color?: ReturnType<typeof rgb>) {
    const c = color || (big ? EMBER : WALNUT);
    page.drawText(label, { x: totalsBoxX + 14, y: ty, size: big ? 12 : 10.5, font: big ? bold : font, color: c });
    rightAlignedText(value, rightEdge - 14, ty, big ? 13 : 10.5, big ? bold : font, c);
    ty -= totalsRowH;
  }
  totalsRow("Subtotal", `$${subtotal.toFixed(2)}`);
  totalsRow(`Sales Tax (${(SALES_TAX_RATE * 100).toFixed(0)}%)`, `$${tax.toFixed(2)}`);
  page.drawLine({ start: { x: totalsBoxX + 14, y: ty + 14 }, end: { x: rightEdge - 14, y: ty + 14 }, thickness: 1, color: WALNUT });
  totalsRow("Total", `$${total.toFixed(2)}`, true, WALNUT);
  totalsRow("Amount Paid", `$${paid.toFixed(2)}`);
  // ty now sits just below "Amount Paid" — the Amount Due band starts a
  // clear gap further down from there, so it can never overlap the row above.
  const dueBoxTop = ty + totalsRowH - dueGap;
  const dueBoxBottom = dueBoxTop - dueBoxHeight;
  page.drawRectangle({ x: totalsBoxX, y: dueBoxBottom, width: totalsBoxWidth, height: dueBoxHeight, color: isPaidInFull ? SAGE : EMBER });
  const dueTextY = dueBoxBottom + (dueBoxHeight - 13) / 2 + 2;
  page.drawText("Amount Due", { x: totalsBoxX + 14, y: dueTextY, size: 14, font: bold, color: WHITE });
  rightAlignedText(`$${due.toFixed(2)}`, rightEdge - 14, dueTextY, 16, bold, WHITE);
  y = dueBoxBottom - 54;

  // ===== NOTES =====
  // No dedicated per-invoice notes field exists in the data model today
  // (checked the invoices table directly) — these two lines are the
  // same standing notes text the invoice has always shown, just
  // restyled in a card matching the totals/table sections, not new or
  // invented content.
  const notesBoxHeight = 74;
  page.drawRectangle({ x: marginX, y: y - notesBoxHeight + 20, width: rightEdge - marginX, height: notesBoxHeight, color: CREAM });
  page.drawText("NOTES", { x: marginX + 14, y, size: 9, font: bold, color: GRAY });
  y -= 20;
  page.drawText("Thank you for your business!", { x: marginX + 14, y, size: 10, font, color: WALNUT });
  y -= 16;
  page.drawText("Sales tax collected in accordance with Michigan law.", { x: marginX + 14, y, size: 10, font, color: WALNUT });

  // ===== FOOTER (fixed at the bottom of the page, matching the emails) =====
  const footerY = 58;
  page.drawLine({ start: { x: marginX, y: footerY + 26 }, end: { x: rightEdge, y: footerY + 26 }, thickness: 1, color: LIGHT_LINE });
  const footerLine1 = `Sunrise Wood Creations LLC  ·  ${opts.contactPhone}  ·  ${opts.contactEmail}`;
  const footerLine1Width = font.widthOfTextAtSize(footerLine1, 9);
  page.drawText(footerLine1, { x: (width - footerLine1Width) / 2, y: footerY + 8, size: 9, font: bold, color: GRAY });
  const footerLine2 = "Handmade in Michigan  ·  Built to order  ·  Local pickup";
  const footerLine2Width = font.widthOfTextAtSize(footerLine2, 8.5);
  page.drawText(footerLine2, { x: (width - footerLine2Width) / 2, y: footerY - 8, size: 8.5, font, color: MUTED_TAN });

  const bytes = await doc.save();
  return Buffer.from(bytes);
}

// Call this whenever an order's payment changes, or when it's marked
// "picked_up" — each call generates and emails a fresh invoice reflecting
// the current total, amount paid, and balance due at that moment.
// Checks whether enough stock is on hand to cover every item on this
// order and, if so, deducts it and marks the order Ready for Pickup —
// all-or-nothing across every item (if even one linked item doesn't
// have enough stock, nothing gets deducted and the status stays as-is).
// Used both when generating an invoice (existing behavior, unchanged)
// and right at order creation (new — so an order that's already fully
// in stock skips straight to Ready for Pickup instead of waiting for a
// deposit or manual status change).
export async function checkStockAndAutoMarkReady(admin: ReturnType<typeof createAdminClient>, order: any): Promise<void> {
  if (order.stock_deducted) return;

  const { data: orderItems } = await admin
    .from("order_items")
    .select("id, product_id, title, quantity, unit_price_cents")
    .eq("order_id", order.id);

  const hasLineItems = orderItems && orderItems.length > 0;

  if (hasLineItems) {
    const linkedItems = orderItems!.filter(it => it.product_id);
    if (linkedItems.length > 0) {
      const { data: productRows } = await admin
        .from("products")
        .select("id, stock_quantity")
        .in("id", linkedItems.map(it => it.product_id));

      const stockById: Record<string, number> = {};
      (productRows || []).forEach((p: any) => { stockById[p.id] = p.stock_quantity || 0; });

      const allInStock = linkedItems.every(it => (stockById[it.product_id] || 0) >= it.quantity);

      if (allInStock) {
        for (const it of linkedItems) {
          await admin
            .from("products")
            .update({ stock_quantity: stockById[it.product_id] - it.quantity })
            .eq("id", it.product_id);
          await checkAndSendLowStockAlert(admin, it.product_id);
        }
        await admin.from("orders").update({ status: "ready_for_pickup", stock_deducted: true }).eq("id", order.id);
        order.status = "ready_for_pickup";
        order.stock_deducted = true;
      }
    }
  } else if (order.product_id) {
    // Legacy single-item order with no order_items rows.
    const { data: product } = await admin
      .from("products")
      .select("stock_quantity")
      .eq("id", order.product_id)
      .maybeSingle();

    const neededQty = order.quantity || 1;
    if (product && (product.stock_quantity || 0) >= neededQty) {
      await admin.from("products").update({ stock_quantity: product.stock_quantity - neededQty }).eq("id", order.product_id);
      await checkAndSendLowStockAlert(admin, order.product_id);
      await admin.from("orders").update({ status: "ready_for_pickup", stock_deducted: true }).eq("id", order.id);
      order.status = "ready_for_pickup";
      order.stock_deducted = true;
    }
  }
}

export async function generateInvoicePdfForOrder(
  order: any,
  customer: { full_name: string; email?: string }
): Promise<{ pdfBuffer: Buffer; invoiceNumber: number; invoiceYear: number; paidInFull: boolean } | null> {
  const admin = createAdminClient();

  const { data: orderItems } = await admin
    .from("order_items")
    .select("id, product_id, title, quantity, unit_price_cents")
    .eq("order_id", order.id);

  const hasLineItems = orderItems && orderItems.length > 0;

  await checkStockAndAutoMarkReady(admin, order);

  // An order should only ever have ONE invoice number — reused and
  // updated in place as the balance changes (e.g. a deposit invoice
  // later becomes the final paid-in-full invoice at pickup), not a new
  // invoice number every time this function runs.
  const { data: existingInvoice } = await admin
    .from("invoices")
    .select("invoice_number, invoice_year")
    .eq("order_id", order.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Invoice numbers reset to 1100 at the start of each calendar year
  // (e.g. 2026-1100, then 2027-1100), so "the next number" is always
  // scoped to the current year, not all-time. Eastern time, matching
  // every other date calculation in this app.
  const currentYear = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric" }).format(new Date())
  );

  let invoiceNumber: number;
  let invoiceYear: number;
  if (existingInvoice) {
    invoiceNumber = existingInvoice.invoice_number;
    invoiceYear = existingInvoice.invoice_year; // never changes once assigned, even if reused in a later calendar year
  } else {
    // Compute the next invoice number directly from what's already in the
    // table for THIS year, rather than a separate database sequence —
    // one less moving part that could silently get out of sync.
    const { data: maxRow, error: maxError } = await admin
      .from("invoices")
      .select("invoice_number")
      .eq("invoice_year", currentYear)
      .order("invoice_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (maxError) {
      console.error("Couldn't determine next invoice number:", maxError.message);
      return null;
    }
    invoiceNumber = (maxRow?.invoice_number || 1099) + 1;
    invoiceYear = currentYear;
  }

  const lineItems: InvoiceLineItem[] = hasLineItems
    ? orderItems!.map((it: any) => ({
        description: it.title,
        quantity: it.quantity || 1,
        lineTotalCents: (it.unit_price_cents || 0) * (it.quantity || 1)
      }))
    : [{
        description: `${productLabel(order.product_type as ProductType)} — ${order.title}`,
        quantity: order.quantity || 1,
        lineTotalCents: order.price_cents || 0
      }];

  const contactInfo = await getInvoiceContactInfo(admin);

  const pdfBuffer = await buildInvoicePdf({
    invoiceNumber,
    invoiceYear,
    invoiceDate: new Date(order.created_at),
    customerName: customer.full_name,
    customerEmail: customer.email,
    lineItems,
    totalCents: order.price_cents || 0,
    paidCents: order.amount_paid_cents || 0,
    contactPhone: contactInfo.phone,
    contactEmail: contactInfo.email
  });

  const filename = `invoice-${invoiceYear}-${invoiceNumber}-${order.id}.pdf`;
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

  // Scoped by order_id, not invoice_number — since numbers now reset
  // every year, two different invoices from different years could
  // otherwise share the same number and both get updated by mistake.
  // Every order has at most one invoice, so order_id is always unique here.
  if (existingInvoice) {
    await admin.from("invoices").update({ pdf_url: pdfUrl, paid_in_full: paidInFull }).eq("order_id", order.id);
  } else {
    await admin.from("invoices").insert({
      order_id: order.id,
      invoice_number: invoiceNumber,
      invoice_year: invoiceYear,
      pdf_url: pdfUrl,
      paid_in_full: paidInFull
    });
  }

  return { pdfBuffer, invoiceNumber, invoiceYear, paidInFull };
}

export async function issueInvoiceForOrder(
  order: any,
  customer: { email: string; full_name: string; has_real_email?: boolean; notify_invoices?: boolean }
) {
  const admin = createAdminClient();

  const result = await generateInvoicePdfForOrder(order, customer);
  if (!result) return;
  const { pdfBuffer, invoiceNumber, invoiceYear, paidInFull } = result;

  // The invoice PDF is always generated and stored (so it's there for the
  // customer's account page or a manual download) even if we don't email
  // it — the preference only controls whether an email actually goes out.
  if (shouldNotify(customer, "invoices")) {
    try {
      await sendInvoiceEmail({
        toEmail: customer.email,
        customerName: customer.full_name,
        orderTitle: order.title,
        paidInFull,
        invoiceNumber,
        invoiceYear,
        pdfBuffer
      });
      await admin.from("invoices").update({ sent_at: new Date().toISOString() }).eq("order_id", order.id);
    } catch (err) {
      console.error("Invoice email failed to send:", err);
    }
  }
}
