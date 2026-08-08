import { Resend } from "resend";
import { productLabel, statusLabel, ProductType } from "./statusSteps";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM || "Sunrise Wood Creations <orders@sunrisewoodcreations.com>";
const FROM_INVOICE = process.env.EMAIL_FROM_INVOICE || "Sunrise Wood Creations <invoice@sunrisewoodcreations.com>";
const FROM_ADMIN_REPORT = process.env.EMAIL_FROM_ADMIN_REPORT || "Sunrise Wood Creations <reports@sunrisewoodcreations.com>";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://sunrisewoodcreations.com";

function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

type EmailButton = { text: string; url: string; color?: string };

function shell(opts: { preheader: string; bodyHtml: string; buttonText?: string; buttonUrl?: string; buttons?: EmailButton[] }) {
  // Multiple buttons (used by the quote email's View/Accept/Decline) is
  // additive — every existing caller still just passes buttonText/buttonUrl
  // and gets the exact same single-button output as before.
  const allButtons: EmailButton[] = opts.buttons && opts.buttons.length > 0
    ? opts.buttons
    : (opts.buttonUrl && opts.buttonText ? [{ text: opts.buttonText, url: opts.buttonUrl, color: "#D9603A" }] : []);

  const button = allButtons.length > 0
    ? `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
      <tr>
        ${allButtons.map(b => `
        <td style="background-color: ${b.color || "#D9603A"}; border-radius: 8px; padding-right: 10px;">
          <a href="${b.url}" style="display: inline-block; padding: 14px 22px; font-family: Georgia, 'Times New Roman', serif; font-size: 14px; font-weight: bold; color: #ffffff; text-decoration: none; border-radius: 8px;">
            ${b.text}
          </a>
        </td>`).join("")}
      </tr>
    </table>`
    : "";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #F7F1E6;">
  <div style="display: none; max-height: 0; overflow: hidden;">${opts.preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #F7F1E6; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 480px; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e5d9c3;" cellpadding="0" cellspacing="0">
          <tr>
            <td style="background-color: #3D2B1F; padding: 24px 32px;">
              <span style="font-family: Georgia, 'Times New Roman', serif; font-size: 20px; font-weight: bold; color: #F7F1E6;">
                Sunrise Wood Creations
              </span>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #2A211C;">
              ${opts.bodyHtml}
              ${button}
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 32px; background-color: #F7F1E6; border-top: 1px solid #e5d9c3; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 13px; color: #8a7a6b;">
              <p style="margin: 0 0 8px;">
                This inbox is not monitored — we don't receive replies sent here.
              </p>
              <p style="margin: 0;">
                Questions? Call <a href="tel:2697621460" style="color: #8a7a6b;">(269) 762-1460</a> or email
                <a href="mailto:sunrisewoodcreations@gmail.com" style="color: #8a7a6b;">sunrisewoodcreations@gmail.com</a>.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendOrderStatusEmail(opts: {
  toEmail: string;
  customerName: string;
  productType: ProductType;
  orderTitle: string;
  orderId: string;
  newStatus: string;
  balanceDueCents?: number;
  invoicePdfBuffer?: Buffer;
  invoiceNumber?: number;
  invoiceYear?: number;
}) {
  const label = statusLabel(opts.productType, opts.newStatus);
  const balanceHtml = typeof opts.balanceDueCents === "number"
    ? opts.balanceDueCents > 0
      ? `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 16px 0;">
          <tr>
            <td style="background-color: #FCEFDC; border-radius: 8px; padding: 14px 16px;">
              <span style="color: #6b4d1a;">Balance to bring at pickup:</span>
              <strong style="font-size: 18px; color: #D9603A; display: block; margin-top: 4px;">
                $${(opts.balanceDueCents / 100).toFixed(2)}
              </strong>
            </td>
          </tr>
        </table>`
      : `
        <p style="margin: 16px 0 0; color: #3f7a5a; font-weight: bold;">
          Your balance is fully paid — nothing to bring but yourself!
        </p>`
    : "";

  const html = shell({
    preheader: `Your order has moved to: ${label}`,
    bodyHtml: `
      <p style="margin: 0 0 16px;">Hi ${opts.customerName},</p>
      <p style="margin: 0 0 16px;">
        Your order — <strong>${productLabel(opts.productType)}: ${opts.orderTitle}</strong> — has moved to:
      </p>
      <p style="margin: 0; font-size: 20px; font-weight: bold; color: #D9603A; font-family: Georgia, serif;">
        ${label}
      </p>
      ${balanceHtml}
    `,
    buttonText: "View your order",
    buttonUrl: `${SITE_URL}/account/orders/${opts.orderId}`
  });

  const attachments = opts.invoicePdfBuffer && opts.invoiceNumber && opts.invoiceYear
    ? [{ filename: `invoice-${opts.invoiceYear}-${opts.invoiceNumber}.pdf`, content: opts.invoicePdfBuffer.toString("base64") }]
    : undefined;

  return resend.emails.send({
    from: FROM,
    to: opts.toEmail,
    subject: `Your order is now: ${label}`,
    html,
    ...(attachments ? { attachments } : {})
  });
}

export async function sendProofReadyEmail(opts: {
  toEmail: string;
  customerName: string;
  orderTitle: string;
  orderId: string;
  imageUrl: string;
  respondToken: string;
}) {
  const reviewUrl = `${SITE_URL}/proof/${opts.respondToken}`;

  let attachments: { filename: string; content: string }[] = [];
  try {
    const imgRes = await fetch(opts.imageUrl);
    if (imgRes.ok) {
      const buffer = Buffer.from(await imgRes.arrayBuffer());
      const ext = opts.imageUrl.split(".").pop()?.split("?")[0] || "jpg";
      attachments = [{ filename: `design-proof.${ext}`, content: buffer.toString("base64") }];
    }
  } catch {
    // Attachment is a nice-to-have, not essential — continue without it.
  }

  const html = shell({
    preheader: "Your cornhole design proof is ready to review",
    bodyHtml: `
      <p style="margin: 0 0 16px;">Hi ${opts.customerName},</p>
      <p style="margin: 0 0 16px;">
        We've attached the design proof for your cornhole boards — <strong>${opts.orderTitle}</strong>. Take a look, then approve it or let us know what to change — right from this email, no login needed.
      </p>
    `,
    buttonText: "Approve or request changes",
    buttonUrl: reviewUrl
  });

  return resend.emails.send({
    from: FROM,
    to: opts.toEmail,
    subject: "Your cornhole design proof is ready to review",
    html,
    attachments
  });
}

export async function sendProofDeclinedNotice(opts: {
  orderTitle: string;
  orderId: string;
  customerName: string;
  feedback: string;
}) {
  const html = shell({
    preheader: `${opts.customerName} requested changes on ${opts.orderTitle}`,
    bodyHtml: `
      <p style="margin: 0 0 16px;">
        <strong>${opts.customerName}</strong> requested changes on the proof for <strong>${opts.orderTitle}</strong>.
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 8px;">
        <tr>
          <td style="background-color: #FCEFDC; border-radius: 8px; padding: 14px 16px; font-style: italic; color: #6b4d1a;">
            "${opts.feedback}"
          </td>
        </tr>
      </table>
    `,
    buttonText: "Open the order",
    buttonUrl: `${SITE_URL}/admin/orders/${opts.orderId}`
  });

  return resend.emails.send({
    from: FROM,
    to: process.env.SHOP_NOTIFY_EMAIL || "sunrisewoodcreations@gmail.com",
    subject: `Changes requested: ${opts.orderTitle}`,
    html
  });
}

export async function sendProofApprovedNotice(opts: {
  orderTitle: string;
  orderId: string;
  customerName: string;
}) {
  const html = shell({
    preheader: `${opts.customerName} approved the proof for ${opts.orderTitle}`,
    bodyHtml: `
      <p style="margin: 0 0 16px;">
        <strong>${opts.customerName}</strong> approved the design proof for <strong>${opts.orderTitle}</strong>.
      </p>
      <p style="margin: 0;">It's ready to move into production.</p>
    `,
    buttonText: "Open the order",
    buttonUrl: `${SITE_URL}/admin/orders/${opts.orderId}`
  });

  return resend.emails.send({
    from: FROM,
    to: process.env.SHOP_NOTIFY_EMAIL || "sunrisewoodcreations@gmail.com",
    subject: `Design approved: ${opts.orderTitle}`,
    html
  });
}

export async function sendQuoteEmail(opts: {
  toEmail: string;
  customerName: string;
  quoteNumberDisplay: string;
  isRevision: boolean;
  totalCents: number;
  expirationDateDisplay: string;
  shareUrl: string;
  acceptUrl: string;
  declineUrl: string;
  pdfBuffer: Buffer;
}) {
  const total = (opts.totalCents / 100).toFixed(2);
  const revisedNote = opts.isRevision
    ? `<p style="margin: 0 0 16px; color: #B35A39; font-weight: 600;">This is a revised version of a quote you previously received — please disregard any earlier version.</p>`
    : "";
  const html = shell({
    preheader: opts.isRevision ? `Revised quote #${opts.quoteNumberDisplay} — $${total}` : `Quote #${opts.quoteNumberDisplay} — $${total}`,
    bodyHtml: `
      <p style="margin: 0 0 16px;">Hi ${opts.customerName},</p>
      ${revisedNote}
      <p style="margin: 0 0 16px;">
        Attached is ${opts.isRevision ? "a revised" : ""} quote #${opts.quoteNumberDisplay} for <strong>$${total}</strong>, valid through ${opts.expirationDateDisplay}.
        Review it online, then accept or decline it directly — no login needed.
      </p>
    `,
    buttons: [
      { text: "View Quote", url: opts.shareUrl, color: "#1E3A5F" },
      { text: "Accept Quote", url: opts.acceptUrl, color: "#4F7A55" },
      { text: "Decline Quote", url: opts.declineUrl, color: "#8a8a8a" }
    ]
  });

  return resend.emails.send({
    from: FROM_INVOICE,
    to: opts.toEmail,
    subject: opts.isRevision
      ? `Revised Quote #${opts.quoteNumberDisplay} — Sunrise Wood Creations`
      : `Quote #${opts.quoteNumberDisplay} — Sunrise Wood Creations`,
    html,
    attachments: [
      { filename: `quote-${opts.quoteNumberDisplay}.pdf`, content: opts.pdfBuffer.toString("base64") }
    ]
  });
}

export async function sendInvoiceEmail(opts: {
  toEmail: string;
  customerName: string;
  orderTitle: string;
  invoiceNumber: number;
  invoiceYear: number;
  paidInFull: boolean;
  pdfBuffer: Buffer;
}) {
  const displayNumber = `${opts.invoiceYear}-${opts.invoiceNumber}`;
  const message = opts.paidInFull
    ? `Attached is your final invoice (#${displayNumber}) for <strong>${opts.orderTitle}</strong> — paid in full. Thanks so much for your business!`
    : `Attached is your updated invoice (#${displayNumber}) for <strong>${opts.orderTitle}</strong>, showing your payment and the remaining balance.`;

  const html = shell({
    preheader: opts.paidInFull ? `Paid in full — Invoice #${displayNumber}` : `Invoice #${displayNumber} update`,
    bodyHtml: `
      <p style="margin: 0 0 16px;">Hi ${opts.customerName},</p>
      <p style="margin: 0 0 16px;">${message}</p>
    `
  });

  return resend.emails.send({
    from: FROM_INVOICE,
    to: opts.toEmail,
    subject: opts.paidInFull
      ? `Paid in full — Invoice #${displayNumber} — Sunrise Wood Creations`
      : `Invoice #${displayNumber} — Sunrise Wood Creations`,
    html,
    attachments: [
      { filename: `invoice-${displayNumber}.pdf`, content: opts.pdfBuffer.toString("base64") }
    ]
  });
}

export async function sendNewMessageNotice(opts: {
  orderTitle: string;
  orderId: string;
  customerName: string;
  messageBody: string;
}) {
  const html = shell({
    preheader: `${opts.customerName} sent a message about ${opts.orderTitle}`,
    bodyHtml: `
      <p style="margin: 0 0 16px;">
        <strong>${opts.customerName}</strong> sent a new message about <strong>${opts.orderTitle}</strong>:
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 8px;">
        <tr>
          <td style="background-color: #FCEFDC; border-radius: 8px; padding: 14px 16px; font-style: italic; color: #6b4d1a;">
            "${opts.messageBody}"
          </td>
        </tr>
      </table>
    `,
    buttonText: "Open the order",
    buttonUrl: `${SITE_URL}/admin/orders/${opts.orderId}`
  });

  return resend.emails.send({
    from: FROM,
    to: process.env.SHOP_NOTIFY_EMAIL || "sunrisewoodcreations@gmail.com",
    subject: `New message: ${opts.orderTitle}`,
    html
  });
}

export async function sendCustomerNewMessageNotice(opts: {
  toEmail: string;
  customerName: string;
  orderTitle: string;
  orderId: string;
  messageBody: string;
}) {
  const html = shell({
    preheader: `New message about your order: ${opts.orderTitle}`,
    bodyHtml: `
      <p style="margin: 0 0 16px;">Hi ${opts.customerName},</p>
      <p style="margin: 0 0 16px;">
        You've got a new message about your order — <strong>${opts.orderTitle}</strong>:
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 8px;">
        <tr>
          <td style="background-color: #FCEFDC; border-radius: 8px; padding: 14px 16px; font-style: italic; color: #6b4d1a;">
            "${opts.messageBody}"
          </td>
        </tr>
      </table>
    `,
    buttonText: "View and reply",
    buttonUrl: `${SITE_URL}/account/orders/${opts.orderId}`
  });

  return resend.emails.send({
    from: FROM,
    to: opts.toEmail,
    subject: `New message about your order: ${opts.orderTitle}`,
    html
  });
}

export async function sendGuestMessageNotice(opts: {
  name: string;
  email: string;
  body: string;
}) {
  const safeName = escapeHtml(opts.name);
  const safeBody = escapeHtml(opts.body);

  const html = shell({
    preheader: `New website chat message from ${safeName}`,
    bodyHtml: `
      <p style="margin: 0 0 16px;">
        <strong>${safeName}</strong> (${escapeHtml(opts.email)}) sent a message through the website chat bubble:
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 8px;">
        <tr>
          <td style="background-color: #FCEFDC; border-radius: 8px; padding: 14px 16px; font-style: italic; color: #6b4d1a;">
            "${safeBody}"
          </td>
        </tr>
      </table>
      <p style="margin: 16px 0 0; font-size: 13px; color: #8a7a6b;">
        Just reply directly to this email to write back to them at ${escapeHtml(opts.email)}.
      </p>
    `
  });

  return resend.emails.send({
    from: FROM,
    replyTo: opts.email,
    to: process.env.SHOP_NOTIFY_EMAIL || "sunrisewoodcreations@gmail.com",
    subject: `Website chat: ${safeName}`,
    html
  });
}

export async function sendLowStockAlert(opts: {
  productName: string;
  remainingStock: number;
  threshold: number;
}) {
  const html = shell({
    preheader: `Low stock: ${opts.productName}`,
    bodyHtml: `
      <p style="margin: 0 0 16px;">
        <strong>${escapeHtml(opts.productName)}</strong> is running low —
        only <strong>${opts.remainingStock}</strong> left on hand (your alert threshold is ${opts.threshold}).
      </p>
      <p style="margin: 0;">Might be time to make more.</p>
    `,
    buttonText: "Open Products",
    buttonUrl: `${SITE_URL}/admin/products`
  });

  return resend.emails.send({
    from: FROM,
    to: process.env.SHOP_NOTIFY_EMAIL || "sunrisewoodcreations@gmail.com",
    subject: `Low stock: ${opts.productName}`,
    html
  });
}

export async function sendQuoteRequestNotice(opts: {
  name: string;
  email: string;
  phone?: string;
  productType?: string;
  dimensions?: string;
  woodType?: string;
  budget?: string;
  timeline?: string;
  description: string;
}) {
  const row = (label: string, value?: string) =>
    value ? `<p style="margin: 0 0 6px;"><strong>${label}:</strong> ${escapeHtml(value)}</p>` : "";

  const html = shell({
    preheader: `New quote request from ${escapeHtml(opts.name)}`,
    bodyHtml: `
      <p style="margin: 0 0 16px;">New custom quote request:</p>
      ${row("Name", opts.name)}
      ${row("Email", opts.email)}
      ${row("Phone", opts.phone)}
      ${row("Product type", opts.productType)}
      ${row("Dimensions", opts.dimensions)}
      ${row("Wood type", opts.woodType)}
      ${row("Budget", opts.budget)}
      ${row("Timeline", opts.timeline)}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 12px 0 8px;">
        <tr>
          <td style="background-color: #FCEFDC; border-radius: 8px; padding: 14px 16px; font-style: italic; color: #6b4d1a;">
            "${escapeHtml(opts.description)}"
          </td>
        </tr>
      </table>
      <p style="margin: 16px 0 0; font-size: 13px; color: #8a7a6b;">
        Reply directly to this email to write back to ${escapeHtml(opts.email)}.
      </p>
    `
  });

  return resend.emails.send({
    from: FROM,
    replyTo: opts.email,
    to: process.env.SHOP_NOTIFY_EMAIL || "sunrisewoodcreations@gmail.com",
    subject: `Quote request: ${opts.name}`,
    html
  });
}

export async function sendFinancialReportEmail(opts: {
  toEmail: string;
  periodLabel: string;
  totalRevenue: number;
  totalMaterialsCost: number;
  totalProfit: number;
  salesTaxOwed: number;
  michiganIncomeTaxOwed: number;
  federalIncomeTaxOwed: number;
  pdfBuffer: Buffer;
}) {
  const html = shell({
    preheader: `Your ${opts.periodLabel} financial summary is ready`,
    bodyHtml: `
      <p style="margin: 0 0 16px;">Here's your financial summary for <strong>${opts.periodLabel}</strong>:</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 16px;">
        <tr><td style="padding: 4px 0; color: #6b4d1a;">Total sales:</td><td style="padding: 4px 0; text-align: right; font-weight: bold;">$${opts.totalRevenue.toFixed(2)}</td></tr>
        <tr><td style="padding: 4px 0; color: #6b4d1a;">Materials used (planters):</td><td style="padding: 4px 0; text-align: right; font-weight: bold;">$${opts.totalMaterialsCost.toFixed(2)}</td></tr>
        <tr><td style="padding: 4px 0; color: #6b4d1a;">Profit:</td><td style="padding: 4px 0; text-align: right; font-weight: bold;">$${opts.totalProfit.toFixed(2)}</td></tr>
        <tr><td style="padding: 4px 0; color: #6b4d1a;">Sales tax owed (6% MI):</td><td style="padding: 4px 0; text-align: right; font-weight: bold; color: #D9603A;">$${opts.salesTaxOwed.toFixed(2)}</td></tr>
        <tr><td style="padding: 4px 0; color: #6b4d1a;">Michigan income tax:</td><td style="padding: 4px 0; text-align: right; font-weight: bold; color: #D9603A;">$${opts.michiganIncomeTaxOwed.toFixed(2)}</td></tr>
        <tr><td style="padding: 4px 0; color: #6b4d1a;">Federal income tax (set-aside):</td><td style="padding: 4px 0; text-align: right; font-weight: bold; color: #D9603A;">$${opts.federalIncomeTaxOwed.toFixed(2)}</td></tr>
      </table>
      <p style="margin: 0 0 8px; font-size: 13px; color: #8a7a6b;">
        Sales tax and Michigan income tax use real statutory rates. Federal income tax is a planning estimate you
        control in Report Settings, since it genuinely depends on your total income and filing status — confirm
        exact amounts owed with your tax preparer.
      </p>
      <p style="margin: 0; font-size: 13px; color: #8a7a6b;">Full item-by-item breakdown is attached as a PDF.</p>
    `
  });

  return resend.emails.send({
    from: FROM_ADMIN_REPORT,
    to: opts.toEmail,
    subject: `Financial summary: ${opts.periodLabel}`,
    html,
    attachments: [
      { filename: `financial-summary-${opts.periodLabel.replace(/\s+/g, "-")}.pdf`, content: opts.pdfBuffer.toString("base64") }
    ]
  });
}
