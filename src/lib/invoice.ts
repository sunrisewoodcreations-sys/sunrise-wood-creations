import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendInvoiceEmail, sendLowStockAlert } from "@/lib/email";
import { shouldNotify } from "@/lib/notify";
import { productLabel, ProductType } from "@/lib/statusSteps";

const SALES_TAX_RATE = 0.06; // Michigan
const WALNUT = rgb(0.1176, 0.2275, 0.3725);
const CREAM = rgb(1, 1, 1);
const EMBER = rgb(0.85, 0.376, 0.227);
const GRAY = rgb(0.4, 0.4, 0.4);
const LIGHT_LINE = rgb(0.85, 0.85, 0.85);
const GREEN = rgb(0.22, 0.5, 0.34);

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
  lineItems: InvoiceLineItem[];
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

  const metaX = width - 220;
  function metaRow(label: string, value: string, yy: number, color?: ReturnType<typeof rgb>) {
    page.drawText(label, { x: metaX, y: yy, size: 10, font: bold, color: GRAY });
    page.drawText(value, { x: metaX + 110, y: yy, size: 10, font, color: color || WALNUT });
  }
  let metaY = height - 100;
  metaRow("Invoice Number:", formatInvoiceNumber(opts.invoiceYear, opts.invoiceNumber), metaY); metaY -= 16;
  metaRow("Invoice Date:", opts.invoiceDate.toLocaleDateString("en-US", { timeZone: "America/New_York", year: "numeric", month: "long", day: "numeric" }), metaY); metaY -= 16;
  metaRow("Amount Due:", `$${due.toFixed(2)}`, metaY, due <= 0 ? GREEN : EMBER);

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

  let subtotal = 0;
  for (const item of opts.lineItems) {
    const qty = Math.max(1, item.quantity || 1);
    const lineSubtotal = (item.lineTotalCents / 100) / (1 + SALES_TAX_RATE);
    const unitSubtotal = lineSubtotal / qty;
    subtotal += lineSubtotal;

    page.drawText(item.description.slice(0, 48), { x: col.desc, y, size: 10, font, color: WALNUT });
    page.drawText(String(qty), { x: col.qty, y, size: 10, font, color: WALNUT });
    page.drawText(`$${unitSubtotal.toFixed(2)}`, { x: col.price, y, size: 10, font, color: WALNUT });
    page.drawText(`$${lineSubtotal.toFixed(2)}`, { x: col.amount, y, size: 10, font, color: WALNUT });
    y -= 18;
    if (y < 140) break; // simple single-page cap for very long item lists
  }

  const tax = total - subtotal;
  y -= 12;

  page.drawLine({ start: { x: 300, y: y + 14 }, end: { x: width - 40, y: y + 14 }, thickness: 1, color: LIGHT_LINE });

  function totalsRow(label: string, value: string, yy: number, big?: boolean, color?: ReturnType<typeof rgb>) {
    const c = color || (big ? EMBER : WALNUT);
    page.drawText(label, { x: 380, y: yy, size: big ? 11 : 10, font: big ? bold : font, color: c });
    page.drawText(value, { x: col.amount, y: yy, size: big ? 11 : 10, font: big ? bold : font, color: c });
  }
  totalsRow("Subtotal:", `$${subtotal.toFixed(2)}`, y); y -= 18;
  totalsRow("Sales Tax (6%):", `$${tax.toFixed(2)}`, y); y -= 18;
  page.drawLine({ start: { x: 300, y: y + 12 }, end: { x: width - 40, y: y + 12 }, thickness: 1, color: WALNUT });
  totalsRow("Total:", `$${total.toFixed(2)}`, y, true); y -= 24;
  totalsRow("Amount paid:", `$${paid.toFixed(2)}`, y); y -= 18;
  totalsRow("Amount Due:", `$${due.toFixed(2)}`, y, true, due <= 0 ? GREEN : EMBER);
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
export async function generateInvoicePdfForOrder(
  order: any,
  customer: { full_name: string }
): Promise<{ pdfBuffer: Buffer; invoiceNumber: number; invoiceYear: number; paidInFull: boolean } | null> {
  const admin = createAdminClient();

  const { data: orderItems } = await admin
    .from("order_items")
    .select("id, product_id, title, quantity, unit_price_cents")
    .eq("order_id", order.id);

  const hasLineItems = orderItems && orderItems.length > 0;

  // Stock check + auto "ready for pickup": this is all-or-nothing across
  // every item on the order — if even one linked item doesn't have enough
  // stock, nothing gets deducted and the status stays as-is.
  if (!order.stock_deducted) {
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

  const pdfBuffer = await buildInvoicePdf({
    invoiceNumber,
    invoiceYear,
    invoiceDate: new Date(order.created_at),
    customerName: customer.full_name,
    lineItems,
    totalCents: order.price_cents || 0,
    paidCents: order.amount_paid_cents || 0
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
