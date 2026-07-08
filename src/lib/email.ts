import { Resend } from "resend";
import { productLabel, statusLabel, ProductType } from "./statusSteps";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM || "Sunrise Wood Creations <orders@sunrisewoodcreations.com>";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://sunrisewoodcreations.com";

function shell(bodyHtml: string) {
  return `
  <div style="font-family: Georgia, serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #2A211C;">
    <div style="font-size: 18px; font-weight: bold; color: #3D2B1F; margin-bottom: 20px;">Sunrise Wood Creations</div>
    ${bodyHtml}
    <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5d9c3; font-size: 12px; color: #8a7a6b;">
      Questions? Call (269) 762-1460 or email sunrisewoodcreations@gmail.com.
    </div>
  </div>`;
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
  const html = shell(`
    <p>Hi ${opts.customerName},</p>
    <p>Your order — <strong>${productLabel(opts.productType)}: ${opts.orderTitle}</strong> — has moved to:</p>
    <p style="font-size: 16px; font-weight: bold; color: #D9603A;">${label}</p>
    <p><a href="${SITE_URL}/account/orders/${opts.orderId}" style="color:#D9603A;">View your order</a></p>
  `);

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
}) {
  const html = shell(`
    <p>Hi ${opts.customerName},</p>
    <p>We've got a design proof ready for your cornhole boards — <strong>${opts.orderTitle}</strong>.</p>
    <p>Take a look and let us know if it's good to go, or if you'd like any changes.</p>
    <p><a href="${SITE_URL}/account/orders/${opts.orderId}" style="color:#D9603A; font-weight:bold;">Review your proof</a></p>
  `);

  return resend.emails.send({
    from: FROM,
    to: opts.toEmail,
    subject: "Your cornhole design proof is ready to review",
    html
  });
}

export async function sendProofDeclinedNotice(opts: {
  orderTitle: string;
  orderId: string;
  customerName: string;
  feedback: string;
}) {
  const html = shell(`
    <p><strong>${opts.customerName}</strong> requested changes on the proof for <strong>${opts.orderTitle}</strong>.</p>
    <p style="background:#FCEFDC; padding:12px; border-radius:6px;">"${opts.feedback}"</p>
    <p><a href="${SITE_URL}/admin/orders/${opts.orderId}" style="color:#D9603A;">Open the order</a></p>
  `);

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
  const html = shell(`
    <p><strong>${opts.customerName}</strong> approved the design proof for <strong>${opts.orderTitle}</strong>.</p>
    <p>It's ready to move into production.</p>
    <p><a href="${SITE_URL}/admin/orders/${opts.orderId}" style="color:#D9603A;">Open the order</a></p>
  `);

  return resend.emails.send({
    from: FROM,
    to: process.env.SHOP_NOTIFY_EMAIL || "sunrisewoodcreations@gmail.com",
    subject: `Design approved: ${opts.orderTitle}`,
    html
  });
}
