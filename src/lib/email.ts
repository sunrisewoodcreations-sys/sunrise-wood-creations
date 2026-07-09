import { Resend } from "resend";
import { productLabel, statusLabel, ProductType } from "./statusSteps";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM || "Sunrise Wood Creations <orders@sunrisewoodcreations.com>";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://sunrisewoodcreations.com";

function shell(opts: { preheader: string; bodyHtml: string; buttonText?: string; buttonUrl?: string }) {
  const button = opts.buttonUrl && opts.buttonText
    ? `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
      <tr>
        <td style="background-color: #D9603A; border-radius: 8px;">
          <a href="${opts.buttonUrl}" style="display: inline-block; padding: 14px 28px; font-family: Georgia, 'Times New Roman', serif; font-size: 15px; font-weight: bold; color: #ffffff; text-decoration: none; border-radius: 8px;">
            ${opts.buttonText}
          </a>
        </td>
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
              Questions? Call <a href="tel:2697621460" style="color: #8a7a6b;">(269) 762-1460</a> or email
              <a href="mailto:sunrisewoodcreations@gmail.com" style="color: #8a7a6b;">sunrisewoodcreations@gmail.com</a>.
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
}) {
  const label = statusLabel(opts.productType, opts.newStatus);
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
    `,
    buttonText: "View your order",
    buttonUrl: `${SITE_URL}/account/orders/${opts.orderId}`
  });

  return resend.emails.send({
    from: FROM,
    to: opts.toEmail,
    subject: `Your order is now: ${label}`,
    html
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

export async function sendInvoiceEmail(opts: {
  toEmail: string;
  customerName: string;
  orderTitle: string;
  invoiceNumber: number;
  pdfBuffer: Buffer;
}) {
  const html = shell({
    preheader: `Invoice #${opts.invoiceNumber} for ${opts.orderTitle}`,
    bodyHtml: `
      <p style="margin: 0 0 16px;">Hi ${opts.customerName},</p>
      <p style="margin: 0 0 16px;">
        Thanks for your order! Attached is your invoice (#${opts.invoiceNumber}) for
        <strong>${opts.orderTitle}</strong>.
      </p>
      <p style="margin: 0;">We appreciate your business.</p>
    `
  });

  return resend.emails.send({
    from: FROM,
    to: opts.toEmail,
    subject: `Invoice #${opts.invoiceNumber} — Sunrise Wood Creations`,
    html,
    attachments: [
      { filename: `invoice-${opts.invoiceNumber}.pdf`, content: opts.pdfBuffer.toString("base64") }
    ]
  });
}
