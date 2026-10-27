import { Resend } from "resend";
import { productLabel, statusLabel, stepsFor, ProductType } from "./statusSteps";
import { emailProductName, formatOrderNumber } from "./orderDisplay";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM || "Sunrise Wood Creations <orders@sunrisewoodcreations.com>";
const FROM_INVOICE = process.env.EMAIL_FROM_INVOICE || "Sunrise Wood Creations <invoice@sunrisewoodcreations.com>";
const FROM_ADMIN_REPORT = process.env.EMAIL_FROM_ADMIN_REPORT || "Sunrise Wood Creations <reports@sunrisewoodcreations.com>";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://sunrisewoodcreations.com";
const DEMO_TEST_EMAIL = process.env.DEMO_TEST_EMAIL || "";

// The single, central choke point every email in this app sends
// through — no exceptions, no second path. Determines demo status
// itself, by checking the currently authenticated request's own
// session (cookies() is request-scoped in Next.js and safely callable
// from anywhere in the same request's call stack) — nothing calling
// this function needs to know or pass whether it's a demo action.
// Cron jobs have no logged-in user at all, so they always fall through
// to sending normally, which is correct: they're never demo actions.
async function sendViaResend(
  payload: {
    from: string; to: string; subject: string; html: string; replyTo?: string;
    attachments?: { filename: string; content: string }[]; emailType: string; orderId?: string;
    // Set by a caller that already knows, from the actual database record
    // being emailed about (an order/quote's own is_demo column, or a
    // customer profile's is_demo_account), that this send is about a
    // test/demo record — independent of whether anyone is currently
    // logged in. The session-based check below (isDemoSender) only ever
    // sees a logged-in user for an admin acting interactively through the
    // website; it can't see anything for a guest clicking an emailed link
    // (no login exists for those routes by design) or a scheduled cron
    // job (no session ever exists there). forceDemo is how those paths
    // get the same protection: interception now happens if EITHER the
    // acting session is demo OR the record itself is flagged demo, so
    // this is purely additive — every existing caller that never passes
    // it behaves exactly as before.
    forceDemo?: boolean;
  }
) {
  const { emailType, orderId, forceDemo, ...resendPayload } = payload;

  let isDemoSender = false;
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase.from("profiles").select("is_demo_account").eq("id", user.id).maybeSingle();
      isDemoSender = !!profile?.is_demo_account;
    }
  } catch {
    // No request context available (e.g. called outside a real request) — never demo in that case.
    isDemoSender = false;
  }

  const shouldIntercept = isDemoSender || !!forceDemo;

  if (!shouldIntercept) {
    return resend.emails.send(resendPayload);
  }

  // Demo path: never contact the real recipient. Redirect to the
  // configured test address (or simply never send, if none is
  // configured) and log the attempt either way, so every "Send Email"
  // action is verifiable from the Demo Mode admin page.
  const admin = createAdminClient();
  let success = false;
  let errorMessage: string | null = null;

  if (DEMO_TEST_EMAIL) {
    try {
      await resend.emails.send({ ...resendPayload, to: DEMO_TEST_EMAIL, subject: `[DEMO] ${resendPayload.subject}` });
      success = true;
    } catch (err: any) {
      errorMessage = err?.message || "Unknown error";
    }
  } else {
    errorMessage = "No DEMO_TEST_EMAIL configured — email captured but not delivered anywhere.";
  }

  await admin.from("demo_email_log").insert({
    email_type: emailType,
    intended_recipient: resendPayload.to,
    redirected_to: DEMO_TEST_EMAIL || "(not delivered — no test address configured)",
    subject: resendPayload.subject,
    html_body: resendPayload.html,
    success,
    error_message: errorMessage,
    order_id: orderId || null
  });

  return { data: { id: "demo-intercepted" } };
}

function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

// Looks up an order's customer-facing number ("SWC-1001", or "DEMO-3" for
// a demo/test order) by its internal id, so every order-status email can
// show it without each of its callers having to pass it in. Read-only,
// and never allowed to block an email: if the lookup fails for any reason
// (including the order_number column not existing yet because the
// database migration hasn't been run), this returns null and the email
// simply leaves the "Order" line out.
async function lookupOrderNumberDisplay(orderId: string): Promise<string | null> {
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("orders").select("order_number, is_demo").eq("id", orderId).maybeSingle();
    return formatOrderNumber(data?.order_number, data?.is_demo);
  } catch {
    return null;
  }
}

// Total + payment status for the confirmation email, built from the
// same two real columns (price_cents, amount_paid_cents) and the same
// "paid in full = balance <= 0" rule already used by PaymentSummary.tsx
// on the account page and throughout the admin panel — not a new,
// separate definition of "paid." Never assumes an order is paid just
// because it exists: an order with no payment yet correctly shows
// "Unpaid," not "Paid."
function paymentStatusHtml(priceCents: number, amountPaidCentsRaw?: number): string {
  const total = Math.max(0, Math.round(priceCents));
  const paid = Math.max(0, Math.round(amountPaidCentsRaw || 0));
  const balance = total - paid;
  const isPaidInFull = balance <= 0;
  const isUnpaid = paid <= 0 && total > 0;

  const statusLabel = isPaidInFull ? "Paid in full" : isUnpaid ? "Unpaid" : "Partially paid";
  const statusColor = isPaidInFull ? "#3f7a5a" : isUnpaid ? "#B23B3B" : "#A63D2F";
  const statusDetail = !isPaidInFull && !isUnpaid
    ? ` <span style="font-weight: normal; color: #74655B;">($${(paid / 100).toFixed(2)} of $${(total / 100).toFixed(2)} paid)</span>`
    : "";

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 16px 0 0;">
      <tr>
        <td style="background-color: #F6EBDD; border-radius: 8px; padding: 14px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td valign="top">
                <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.03em; color: #8a7a6b; margin-bottom: 2px;">Order Total</div>
                <div style="font-size: 16px; font-weight: bold; color: #2E2420;">$${(total / 100).toFixed(2)}</div>
              </td>
              <td valign="top" align="right">
                <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.03em; color: #8a7a6b; margin-bottom: 2px;">Payment Status</div>
                <div style="font-size: 14px; font-weight: bold; color: ${statusColor};">${statusLabel}${statusDetail}</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;
}

type EmailButton = { text: string; url: string; color?: string };

// Defaults match exactly what every email already used before this
// redesign — any caller that doesn't pass contactPhone/contactEmail
// gets identical footer text to before, so this is purely additive.
const DEFAULT_CONTACT_PHONE = "(269) 762-1460";
const DEFAULT_CONTACT_EMAIL = "sunrisewoodcreations@gmail.com";

function shell(opts: {
  preheader: string;
  bodyHtml: string;
  buttonText?: string;
  buttonUrl?: string;
  buttons?: EmailButton[];
  contactPhone?: string;
  contactEmail?: string;
}) {
  // Multiple buttons (used by the quote email's View/Accept/Decline) is
  // additive — every existing caller still just passes buttonText/buttonUrl
  // and gets the exact same single-button output as before.
  const allButtons: EmailButton[] = opts.buttons && opts.buttons.length > 0
    ? opts.buttons
    : (opts.buttonUrl && opts.buttonText ? [{ text: opts.buttonText, url: opts.buttonUrl, color: "#A63D2F" }] : []);

  const button = allButtons.length > 0
    ? `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
      <tr>
        ${allButtons.map(b => `
        <td style="background-color: ${b.color || "#A63D2F"}; border-radius: 8px; padding-right: 10px;">
          <a href="${b.url}" style="display: inline-block; padding: 14px 22px; font-family: Georgia, 'Times New Roman', serif; font-size: 14px; font-weight: bold; color: #ffffff; text-decoration: none; border-radius: 8px;">
            ${b.text}
          </a>
        </td>`).join("")}
      </tr>
    </table>`
    : "";

  const phone = opts.contactPhone || DEFAULT_CONTACT_PHONE;
  const email = opts.contactEmail || DEFAULT_CONTACT_EMAIL;
  const phoneTelHref = phone.replace(/\D/g, "");

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #FAF6EE;">
  <div style="display: none; max-height: 0; overflow: hidden;">${opts.preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #FAF6EE; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 480px; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #E6DCCB;" cellpadding="0" cellspacing="0">
          <tr>
            <td style="background-color: #FAF6EE; padding: 20px 32px; text-align: center; border-bottom: 1px solid #E6DCCB;">
              <img
                src="${process.env.NEXT_PUBLIC_SITE_URL || "https://sunrisewoodcreations.com"}/logo-header.png"
                alt="Sunrise Wood Creations"
                width="150"
                height="40"
                style="height: 40px; width: auto; max-width: 150px; border: 0; display: inline-block;"
              >
            </td>
          </tr>
          <tr>
            <td style="padding: 28px 32px 32px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #2E2420;">
              ${opts.bodyHtml}
              ${button}
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 32px; background-color: #FAF6EE; border-top: 1px solid #E6DCCB; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;">
              <p style="margin: 0 0 10px; font-size: 13px; color: #74655B;">
                Questions? Call <a href="tel:${phoneTelHref}" style="color: #1E3A5F; font-weight: 600; text-decoration: none;">${phone}</a> or email
                <a href="mailto:${email}" style="color: #1E3A5F; font-weight: 600; text-decoration: none;">${email}</a>
              </p>
              <p style="margin: 0 0 14px; font-size: 11px; color: #a89684;">
                This is an automated email, so replies sent directly to it aren't seen — if you need help with your order, please call or email us above.
              </p>
              <p style="margin: 0; font-size: 12px; color: #8a7a6b; font-weight: bold;">Sunrise Wood Creations</p>
              <p style="margin: 2px 0 0; font-size: 11px; color: #a89684;">Handmade in Michigan &bull; Built to order &bull; Local pickup</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// The one line that needs to differ by product, per the approved
// design — every other status uses identical wording regardless of
// product type. Each line reuses phrasing already established on that
// product's own page (e.g. signs are already described site-wide as
// "cut, sanded, and finished by hand").
const PRODUCT_BUILD_LINES: Record<ProductType, string> = {
  cornhole: "Your cornhole boards are now being built and finished by hand.",
  sign: "Your wooden sign is now being cut, sanded, and finished by hand.",
  planter: "Your planter box is now being built and finished by hand.",
  cutting_board: "Your cutting board is now being built and finished by hand."
};

// Heading + body per status key. "being_built"/"being_assembled" have
// no fixed heading here — it's built from the existing statusLabel()
// function instead ("Being Built" vs "Being Made"), so the headline
// can never say something the site's own step list doesn't already say.
const STATUS_COPY: Record<string, { heading?: string; body: (productType: ProductType) => string }> = {
  order_placed: {
    heading: "Your Order Has Been Placed",
    body: () => "Thanks for your order! We've got it queued up and will keep you posted as it moves through the shop."
  },
  deposit_received: {
    heading: "Deposit Received",
    body: () => "We've received your deposit and your order is officially underway. Next, we'll put together a design proof for you to review."
  },
  design_proof_sent: {
    heading: "Design Proof Sent",
    body: () => "We've sent your design proof for review. Check your order for details."
  },
  design_approved: {
    heading: "Design Approved",
    body: () => "Your design is approved and we're getting ready to start building your boards."
  },
  being_built: {
    body: (productType) => PRODUCT_BUILD_LINES[productType]
  },
  being_assembled: {
    body: (productType) => PRODUCT_BUILD_LINES[productType]
  },
  ready_for_pickup: {
    heading: "Ready for Pickup!",
    body: () => "Your order is finished and ready to be picked up."
  },
  picked_up: {
    heading: "Order Complete — Thank You!",
    body: () => "Thanks so much for picking up your order — we hope you enjoy it for years to come."
  }
};

// Same phone/email already used in the site footer (site_settings.contact)
// — read live here so the email never drifts out of sync with whatever
// the business has configured, instead of a second hardcoded copy.
// Falls back to shell()'s own defaults (identical to what every email
// already showed before this change) if the read fails for any reason,
// so a hiccup here can never block an order-status email from sending.
async function getContactInfo(): Promise<{ phone?: string; email?: string }> {
  try {
    const supabase = createClient();
    const { data } = await supabase.from("site_settings").select("data").eq("id", 1).single();
    const contact = (data?.data as any)?.contact;
    if (contact?.phone && contact?.email) {
      return { phone: contact.phone, email: contact.email };
    }
  } catch {
    // Fall through to shell()'s defaults.
  }
  return {};
}

// Table-based, email-safe progress indicator — mirrors the exact same
// color language as the real ProgressTracker.tsx shown on the account
// page (sage = done, ember = current, muted = upcoming), just built
// from <table> cells instead of flexbox, since Gmail and Outlook don't
// reliably support flexbox. Fully driven by stepsFor(productType), the
// same function that already defines the account page's own progress
// bar — so it automatically shows 4 steps for standard products or 7
// for cornhole, and never shows a step that product doesn't have.
function progressBarHtml(productType: ProductType, currentStatus: string, fulfillmentMethod?: string | null): string {
  const steps = stepsFor(productType, fulfillmentMethod);
  const currentIndex = steps.findIndex(s => s.key === currentStatus);
  const n = steps.length;
  // 80% of the row's width is split evenly across the circles, 20% across
  // the connecting bars between them — same ratio at any step count.
  const circleWidthPct = (80 / n).toFixed(2);
  const connectorWidthPct = n > 1 ? (20 / (n - 1)).toFixed(2) : "0";
  const circleSize = n > 5 ? 20 : 22;
  const fontSize = n > 5 ? 11 : 12;
  const labelFontSize = n > 5 ? 8 : 9;

  let circleRow = "";
  let labelRow = "";

  steps.forEach((step, i) => {
    const isDone = currentIndex >= 0 && i < currentIndex;
    const isCurrent = i === currentIndex;

    // Mirrors the real ProgressTracker.tsx exactly (the same component
    // used on the account page and admin panel): done = solid sage
    // circle with a checkmark; current = white circle with a 3px ember
    // border and a small solid ember dot inside, no checkmark — a
    // checkmark means "completed," and the current stage isn't done
    // yet; future = white circle with a muted border, empty.
    let circleTd: string;
    if (isDone) {
      circleTd = `<td style="width:${circleSize}px;height:${circleSize}px;border-radius:50%;background:#4F7A55;color:#fff;font-size:${fontSize}px;font-weight:bold;text-align:center;line-height:${circleSize}px;font-family:Arial,sans-serif;">&#10003;</td>`;
    } else if (isCurrent) {
      const dotSize = Math.max(6, Math.round(circleSize * 0.4));
      circleTd = `<td align="center" valign="middle" style="width:${circleSize}px;height:${circleSize}px;border-radius:50%;background:#ffffff;border:3px solid #A63D2F;"><table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;"><tr><td style="width:${dotSize}px;height:${dotSize}px;border-radius:50%;background:#A63D2F;font-size:0;line-height:0;">&nbsp;</td></tr></table></td>`;
    } else {
      circleTd = `<td style="width:${circleSize}px;height:${circleSize}px;border-radius:50%;background:#ffffff;border:2px solid #E6DCCB;font-size:0;">&nbsp;</td>`;
    }

    circleRow += `<td width="${circleWidthPct}%" align="center" style="font-size:0;"><table cellpadding="0" cellspacing="0" style="margin:0 auto;"><tr>${circleTd}</tr></table></td>`;

    const labelColor = isDone ? "#4F7A55" : isCurrent ? "#A63D2F" : "#a89684";
    const labelWeight = isCurrent ? "font-weight:bold;" : "";
    labelRow += `<td align="center" style="font-size:${labelFontSize}px;color:${labelColor};${labelWeight}padding-top:6px;">${escapeHtml(step.label)}</td>`;

    if (i < n - 1) {
      // Connector after step i: sage if fully between two done steps,
      // ember if it's the one leading into the current step, muted otherwise.
      const connectorColor = i < currentIndex - 1 ? "#4F7A55" : i === currentIndex - 1 ? "#A63D2F" : "#E6DCCB";
      // Bulletproof thin line: a nested single-cell table forces this
      // exact pixel height in Gmail/Outlook — a bare <td style="height:2px">
      // on its own is silently ignored by several email clients, which
      // stretch it to fill the row instead, rendering as a solid block.
      circleRow += `<td width="${connectorWidthPct}%" valign="middle" style="font-size:0;line-height:0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="height:2px;line-height:2px;font-size:1px;background-color:${connectorColor};">&nbsp;</td></tr></table></td>`;
      labelRow += `<td></td>`;
    }
  });

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 4px 0 6px;">
      <tr>${circleRow}</tr>
      <tr>${labelRow}</tr>
    </table>`;
}

export async function sendOrderStatusEmail(opts: {
  toEmail: string;
  customerName: string;
  productType: ProductType;
  orderTitle: string;
  orderId: string;
  newStatus: string;
  // See sendViaResend's forceDemo doc comment — pass the order's own
  // is_demo column here whenever the caller isn't necessarily running
  // inside an authenticated admin session (a guest token route, for
  // instance), so a test order can never email a real inbox just
  // because nobody happened to be logged in as the demo account.
  forceDemo?: boolean;
  balanceDueCents?: number;
  invoicePdfBuffer?: Buffer;
  invoiceNumber?: number;
  invoiceYear?: number;
  // When set (only ever on the ready_for_pickup transition, for a
  // pickup order that still needs a time scheduled), this one email
  // does double duty: it's both the "your order is ready" notice and
  // the pickup-scheduling prompt, with "Schedule My Pickup" as the
  // single primary action instead of the usual "View Your Order" —
  // so the customer gets one email for this event, not two.
  schedulingUrl?: string;
  // "delivery" when the scheduling link is for a delivery order, so the
  // wording says delivery instead of pickup.
  schedulingKind?: "pickup" | "delivery";
  // "delivery" for orders being delivered: changes the wording of the
  // ready / completed emails and the progress bar labels.
  fulfillmentMethod?: string | null;
  // Only passed in today by the order-placed confirmation email (see
  // src/lib/orders.ts) — every other status-update call site is left
  // exactly as it was, so this section only ever appears there.
  priceCents?: number;
  amountPaidCents?: number;
  // The order's customer-facing number, already formatted (for example
  // "SWC-1001"). Optional: when a caller doesn't have it handy, this
  // function looks it up from the order's id itself. createOrder() passes
  // it because it just inserted the order and already has it.
  orderNumberDisplay?: string;
}) {
  const isDeliveryOrder = opts.fulfillmentMethod === "delivery";
  const baseCopy = STATUS_COPY[opts.newStatus];
  const copy = isDeliveryOrder && opts.newStatus === "ready_for_pickup"
    ? { ...baseCopy, heading: "Ready for Delivery!", body: () => "Your order is finished and ready to be delivered. We'll get a delivery time set up with you." }
    : isDeliveryOrder && opts.newStatus === "picked_up"
    ? { ...baseCopy, heading: "Order Delivered — Thank You!", body: () => "Thanks so much for your order — we hope you enjoy it for years to come." }
    : baseCopy;
  // statusLabel() correctly returns sentence case ("Being built") for its
  // other uses (status badges, the admin dropdown) — title-cased here only,
  // just for this heading, rather than changing that shared function.
  const titleCasedLabel = statusLabel(opts.productType, opts.newStatus, opts.fulfillmentMethod)
    .split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
  const heading = copy?.heading || `Your Order Is ${titleCasedLabel}`;
  const bodyLine = copy ? copy.body(opts.productType) : "";

  const balanceHtml = typeof opts.balanceDueCents === "number"
    ? opts.balanceDueCents > 0
      ? `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 16px 0;">
          <tr>
            <td style="background-color: #F6EBDD; border-radius: 8px; padding: 14px 16px;">
              <span style="color: #6b4d1a;">Balance due at ${isDeliveryOrder ? "delivery" : "pickup"}:</span>
              <strong style="font-size: 18px; color: #A63D2F; display: block; margin-top: 4px;">
                $${(opts.balanceDueCents / 100).toFixed(2)}
              </strong>
            </td>
          </tr>
        </table>`
      : `
        <p style="margin: 16px 0 0; color: #3f7a5a; font-weight: bold;">
          ${isDeliveryOrder ? "Your balance is fully paid — nothing due at delivery!" : "Your balance is fully paid — nothing to bring but yourself!"}
        </p>`
    : "";

  const { phone: contactPhone, email: contactEmail } = await getContactInfo();
  const orderNumberDisplay = opts.orderNumberDisplay || await lookupOrderNumberDisplay(opts.orderId);

  const html = shell({
    preheader: heading,
    contactPhone,
    contactEmail,
    bodyHtml: `
      <h1 style="margin: 0 0 6px; font-family: Georgia, 'Times New Roman', serif; font-size: 24px; color: #1E3A5F;">${escapeHtml(heading)}</h1>
      <p style="margin: 0 0 20px; color: #74655B; font-size: 14px;">Hi ${escapeHtml(opts.customerName)},</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 22px;">
        <tr>
          <td style="background-color: #F6EBDD; border-radius: 8px; padding: 14px 16px;">
            <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.03em; color: #8a7a6b; margin-bottom: 2px;">Your Order</div>
            <div style="font-size: 16px; font-weight: bold; color: #2E2420;">${escapeHtml(emailProductName(opts.orderTitle, opts.productType))}</div>
            ${orderNumberDisplay ? `<div style="font-size: 11px; color: #8a7a6b; margin-top: 4px;">Order ${escapeHtml(orderNumberDisplay)}</div>` : ""}
          </td>
        </tr>
      </table>
      ${progressBarHtml(opts.productType, opts.newStatus, opts.fulfillmentMethod)}
      <p style="margin: 20px 0 0;">${escapeHtml(bodyLine)}</p>
      ${balanceHtml}
      ${typeof opts.balanceDueCents !== "number" && typeof opts.priceCents === "number" ? paymentStatusHtml(opts.priceCents, opts.amountPaidCents) : ""}
      ${opts.schedulingUrl ? `<p style="margin: 16px 0 0;">${opts.schedulingKind === "delivery" ? "Confirm your delivery address and pick a day and time that works for you, right from your phone, no login needed." : "Pick a day and time that works for you, right from your phone, no login needed."}</p>` : ""}
    `,
    buttonText: opts.schedulingUrl ? (opts.schedulingKind === "delivery" ? "Schedule My Delivery" : "Schedule My Pickup") : "View Your Order",
    buttonUrl: opts.schedulingUrl || `${SITE_URL}/account/orders/${opts.orderId}`
  });

  const attachments = opts.invoicePdfBuffer && opts.invoiceNumber && opts.invoiceYear
    ? [{ filename: `invoice-${opts.invoiceYear}-${opts.invoiceNumber}.pdf`, content: opts.invoicePdfBuffer.toString("base64") }]
    : undefined;

  return sendViaResend({
    emailType: "sendOrderStatusEmail",
    orderId: (opts as any).orderId,
    forceDemo: opts.forceDemo,
    from: FROM,
    to: opts.toEmail,
    subject: heading,
    html,
    ...(attachments ? { attachments } : {})
  });
}


export async function sendProofReadyEmail(opts: {
  toEmail: string;
  customerName: string;
  productType: ProductType;
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
        We've attached the design proof for your ${productLabel(opts.productType)}. Take a look, then approve it or let us know what you'd like changed — right from this email. No login needed.
      </p>
    `,
    buttonText: "Approve or request changes",
    buttonUrl: reviewUrl
  });

  return sendViaResend({
    emailType: "sendProofReadyEmail",
    orderId: (opts as any).orderId,
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
  forceDemo?: boolean;
}) {
  const html = shell({
    preheader: `${opts.customerName} requested changes on ${opts.orderTitle}`,
    bodyHtml: `
      <p style="margin: 0 0 16px;">
        <strong>${opts.customerName}</strong> requested changes on the proof for <strong>${opts.orderTitle}</strong>.
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 8px;">
        <tr>
          <td style="background-color: #F6EBDD; border-radius: 8px; padding: 14px 16px; font-style: italic; color: #6b4d1a;">
            "${opts.feedback}"
          </td>
        </tr>
      </table>
    `,
    buttonText: "Open the order",
    buttonUrl: `${SITE_URL}/admin/orders/${opts.orderId}`
  });

  return sendViaResend({
    emailType: "sendProofDeclinedNotice",
    orderId: (opts as any).orderId,
    forceDemo: opts.forceDemo,
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
  forceDemo?: boolean;
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

  return sendViaResend({
    emailType: "sendProofApprovedNotice",
    orderId: (opts as any).orderId,
    forceDemo: opts.forceDemo,
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

  return sendViaResend({
    emailType: "sendQuoteEmail",
    orderId: (opts as any).orderId,
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

  return sendViaResend({
    emailType: "sendInvoiceEmail",
    orderId: (opts as any).orderId,
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
          <td style="background-color: #F6EBDD; border-radius: 8px; padding: 14px 16px; font-style: italic; color: #6b4d1a;">
            "${opts.messageBody}"
          </td>
        </tr>
      </table>
    `,
    buttonText: "Open the order",
    buttonUrl: `${SITE_URL}/admin/orders/${opts.orderId}`
  });

  return sendViaResend({
    emailType: "sendNewMessageNotice",
    orderId: (opts as any).orderId,
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
          <td style="background-color: #F6EBDD; border-radius: 8px; padding: 14px 16px; font-style: italic; color: #6b4d1a;">
            "${opts.messageBody}"
          </td>
        </tr>
      </table>
    `,
    buttonText: "View and reply",
    buttonUrl: `${SITE_URL}/account/orders/${opts.orderId}`
  });

  return sendViaResend({
    emailType: "sendCustomerNewMessageNotice",
    orderId: (opts as any).orderId,
    from: FROM,
    to: opts.toEmail,
    subject: `New message about your order: ${opts.orderTitle}`,
    html
  });
}

export async function sendFaqAnswerEmail(opts: {
  name: string;
  email: string;
  question: string;
  answer: string;
  orderId?: string;
}) {
  const safeName = escapeHtml(opts.name);
  const safeQuestion = escapeHtml(opts.question);
  const safeAnswer = escapeHtml(opts.answer);

  const html = shell({
    preheader: `An answer to your question from Sunrise Wood Creations`,
    bodyHtml: `
      <p style="margin: 0 0 16px;">Hi ${safeName}, thanks for reaching out — here's an answer to your question.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 16px;">
        <tr>
          <td style="background-color: #F6EBDD; border-radius: 8px; padding: 14px 16px; font-style: italic; color: #6b4d1a;">
            "${safeQuestion}"
          </td>
        </tr>
      </table>
      <p style="margin: 0 0 16px; white-space: pre-line;">${safeAnswer}</p>
      <p style="margin: 16px 0 0; font-size: 13px; color: #8a7a6b;">
        — Sunrise Wood Creations
      </p>
    `
  });

  return sendViaResend({
    emailType: "sendFaqAnswerEmail",
    orderId: opts.orderId,
    from: FROM,
    to: opts.email,
    subject: "An answer to your question — Sunrise Wood Creations",
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
          <td style="background-color: #F6EBDD; border-radius: 8px; padding: 14px 16px; font-style: italic; color: #6b4d1a;">
            "${safeBody}"
          </td>
        </tr>
      </table>
      <p style="margin: 16px 0 0; font-size: 13px; color: #8a7a6b;">
        Just reply directly to this email to write back to them at ${escapeHtml(opts.email)}.
      </p>
    `
  });

  return sendViaResend({
    emailType: "sendGuestMessageNotice",
    orderId: (opts as any).orderId,
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

  return sendViaResend({
    emailType: "sendLowStockAlert",
    orderId: (opts as any).orderId,
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
          <td style="background-color: #F6EBDD; border-radius: 8px; padding: 14px 16px; font-style: italic; color: #6b4d1a;">
            "${escapeHtml(opts.description)}"
          </td>
        </tr>
      </table>
      <p style="margin: 16px 0 0; font-size: 13px; color: #8a7a6b;">
        Reply directly to this email to write back to ${escapeHtml(opts.email)}.
      </p>
    `
  });

  return sendViaResend({
    emailType: "sendQuoteRequestNotice",
    orderId: (opts as any).orderId,
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
        <tr><td style="padding: 4px 0; color: #6b4d1a;">Sales tax owed (6% MI):</td><td style="padding: 4px 0; text-align: right; font-weight: bold; color: #A63D2F;">$${opts.salesTaxOwed.toFixed(2)}</td></tr>
        <tr><td style="padding: 4px 0; color: #6b4d1a;">Michigan income tax:</td><td style="padding: 4px 0; text-align: right; font-weight: bold; color: #A63D2F;">$${opts.michiganIncomeTaxOwed.toFixed(2)}</td></tr>
        <tr><td style="padding: 4px 0; color: #6b4d1a;">Federal income tax (set-aside):</td><td style="padding: 4px 0; text-align: right; font-weight: bold; color: #A63D2F;">$${opts.federalIncomeTaxOwed.toFixed(2)}</td></tr>
      </table>
      <p style="margin: 0 0 8px; font-size: 13px; color: #8a7a6b;">
        Sales tax and Michigan income tax use real statutory rates. Federal income tax is a planning estimate you
        control in Report Settings, since it genuinely depends on your total income and filing status — confirm
        exact amounts owed with your tax preparer.
      </p>
      <p style="margin: 0; font-size: 13px; color: #8a7a6b;">Full item-by-item breakdown is attached as a PDF.</p>
    `
  });

  return sendViaResend({
    emailType: "sendFinancialReportEmail",
    orderId: (opts as any).orderId,
    from: FROM_ADMIN_REPORT,
    to: opts.toEmail,
    subject: `Financial summary: ${opts.periodLabel}`,
    html,
    attachments: [
      { filename: `financial-summary-${opts.periodLabel.replace(/\s+/g, "-")}.pdf`, content: opts.pdfBuffer.toString("base64") }
    ]
  });
}

// --- Pickup scheduling emails -------------------------------------------
// All three reuse the same shell() wrapper and FROM sender as the
// existing order status emails, since these are conceptually the same
// kind of message (an update about this specific order), just with
// scheduling-specific content and a link to the token-based scheduling
// page instead of the account page.

export async function sendPickupSchedulingEmail(opts: {
  toEmail: string;
  customerName: string;
  orderTitle: string;
  schedulingUrl: string;
  kind?: "pickup" | "delivery";
}) {
  const isDelivery = opts.kind === "delivery";
  const html = shell({
    preheader: `${opts.orderTitle} is ready — schedule your ${isDelivery ? "delivery" : "pickup"}`,
    bodyHtml: `
      <p style="margin: 0 0 16px;">Hi ${opts.customerName},</p>
      <p style="margin: 0 0 16px;">
        Great news — <strong>${opts.orderTitle}</strong> is ready${isDelivery ? " for delivery" : " for pickup"}! ${isDelivery ? "Confirm your delivery address and pick" : "Pick"} a day and time that works for
        you, right from your phone, no login needed.
      </p>
    `,
    buttonText: isDelivery ? "Schedule My Delivery" : "Schedule My Pickup",
    buttonUrl: opts.schedulingUrl
  });

  return sendViaResend({
    emailType: "sendPickupSchedulingEmail",
    orderId: (opts as any).orderId,
    from: FROM,
    to: opts.toEmail,
    subject: `${opts.orderTitle} is ready — schedule your ${isDelivery ? "delivery" : "pickup"}`,
    html
  });
}

export async function sendPickupConfirmationEmail(opts: {
  toEmail: string;
  customerName: string;
  orderTitle: string;
  appointmentDateDisplay: string;
  appointmentTimeDisplay: string;
  businessAddress: string;
  pickupInstructions: string;
  contactPhone: string;
  rescheduleUrl: string;
  googleCalendarUrl: string;
  outlookCalendarUrl: string;
  appleCalendarUrl: string;
  isReschedule: boolean;
  forceDemo?: boolean;
  kind?: "pickup" | "delivery";
  deliveryAddress?: string;
}) {
  const isDelivery = opts.kind === "delivery";
  const noun = isDelivery ? "delivery" : "pickup";
  const Noun = isDelivery ? "Delivery" : "Pickup";
  const html = shell({
    preheader: `${Noun} confirmed: ${opts.appointmentDateDisplay} at ${opts.appointmentTimeDisplay}`,
    bodyHtml: `
      <p style="margin: 0 0 16px;">Hi ${opts.customerName},</p>
      <p style="margin: 0 0 16px;">
        ${opts.isReschedule ? `Your ${noun} has been rescheduled` : `Your ${noun} is confirmed`} for
        <strong>${opts.orderTitle}</strong>:
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 16px;">
        <tr>
          <td style="background-color: #F6EBDD; border-radius: 8px; padding: 16px;">
            <div style="font-size: 18px; font-weight: bold; color: #1E3A5F; font-family: Georgia, serif;">
              ${opts.appointmentDateDisplay} at ${opts.appointmentTimeDisplay}
            </div>
            ${isDelivery
              ? `<div style="margin-top: 10px; color: #74655B; font-size: 14px;">We'll arrive at: ${escapeHtml(opts.deliveryAddress || "your delivery address")}</div>
                 <div style="margin-top: 6px; color: #74655B; font-size: 14px;">We'll let you know when we're on our way.</div>`
              : `<div style="margin-top: 10px; color: #74655B; font-size: 14px;">${opts.businessAddress}</div>
                 <div style="margin-top: 6px; color: #74655B; font-size: 14px;">${opts.pickupInstructions}</div>`}
            <div style="margin-top: 6px; color: #74655B; font-size: 14px;">Questions? Call ${opts.contactPhone}</div>
          </td>
        </tr>
      </table>
      <p style="margin: 0 0 8px; font-size: 13px; color: #8a7a6b;">Add to your calendar:</p>
      <p style="margin: 0 0 16px; font-size: 13px;">
        <a href="${opts.googleCalendarUrl}" style="color: #1E3A5F; font-weight: 600;">Google</a> &nbsp;·&nbsp;
        <a href="${opts.outlookCalendarUrl}" style="color: #1E3A5F; font-weight: 600;">Outlook</a> &nbsp;·&nbsp;
        <a href="${opts.appleCalendarUrl}" style="color: #1E3A5F; font-weight: 600;">Apple Calendar</a>
      </p>
      <p style="margin: 0; font-size: 13px; color: #8a7a6b;">Need a different time? Use the button below.</p>
    `,
    buttonText: `Reschedule ${Noun}`,
    buttonUrl: opts.rescheduleUrl
  });

  return sendViaResend({
    emailType: "sendPickupConfirmationEmail",
    orderId: (opts as any).orderId,
    forceDemo: opts.forceDemo,
    from: FROM,
    to: opts.toEmail,
    subject: opts.isReschedule
      ? `${Noun} rescheduled: ${opts.appointmentDateDisplay} at ${opts.appointmentTimeDisplay}`
      : `${Noun} confirmed: ${opts.appointmentDateDisplay} at ${opts.appointmentTimeDisplay}`,
    html
  });
}

// Notifies the shop (not the customer) the moment a customer books or
// reschedules their own pickup time — so you find out the same way you
// already do for a new quote request or a low-stock alert, without
// having to check the admin page proactively. Includes a one-tap "Add
// to Google Calendar" button (reusing the same link-generation already
// built for the customer's own confirmation email — no calendar
// account connection required) plus a link straight to the admin
// Pickup Appointments page. Deliberately NOT sent when you create or
// change an appointment yourself from the admin side — you already
// know about those.
export async function sendPickupScheduledAdminAlert(opts: {
  orderTitle: string;
  customerName: string;
  customerPhone?: string;
  appointmentDateDisplay: string;
  appointmentTimeDisplay: string;
  googleCalendarUrl: string;
  isReschedule: boolean;
  forceDemo?: boolean;
  kind?: "pickup" | "delivery";
  deliveryAddress?: string;
}) {
  const noun = opts.kind === "delivery" ? "delivery" : "pickup";
  const html = shell({
    preheader: `${opts.isReschedule ? `${noun} rescheduled` : `New ${noun} scheduled`}: ${opts.orderTitle}`,
    bodyHtml: `
      <p style="margin: 0 0 16px;">
        <strong>${escapeHtml(opts.customerName)}</strong> ${opts.isReschedule ? `rescheduled their ${noun}` : `just scheduled a ${noun}`} for
        <strong>${escapeHtml(opts.orderTitle)}</strong>:
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 16px;">
        <tr>
          <td style="background-color: #F6EBDD; border-radius: 8px; padding: 16px;">
            <div style="font-size: 18px; font-weight: bold; color: #1E3A5F; font-family: Georgia, serif;">
              ${opts.appointmentDateDisplay} at ${opts.appointmentTimeDisplay}
            </div>
            ${opts.deliveryAddress ? `<div style="margin-top: 6px; color: #74655B; font-size: 14px;">${escapeHtml(opts.deliveryAddress)}</div>` : ""}
            ${opts.customerPhone ? `<div style="margin-top: 6px; color: #74655B; font-size: 14px;">${escapeHtml(opts.customerPhone)}</div>` : ""}
          </td>
        </tr>
      </table>
    `,
    buttons: [
      { text: "Add to Google Calendar", url: opts.googleCalendarUrl, color: "#4F7A55" },
      { text: "View Pickup Appointments", url: `${SITE_URL}/admin/pickup-appointments`, color: "#A63D2F" }
    ]
  });

  return sendViaResend({
    emailType: "sendPickupScheduledAdminAlert",
    forceDemo: opts.forceDemo,
    from: FROM,
    to: process.env.SHOP_NOTIFY_EMAIL || "sunrisewoodcreations@gmail.com",
    subject: `${opts.isReschedule ? `${noun[0].toUpperCase()}${noun.slice(1)} rescheduled` : `New ${noun} scheduled`}: ${opts.orderTitle} — ${opts.appointmentDateDisplay} at ${opts.appointmentTimeDisplay}`,
    html
  });
}

export async function sendPickupReminderEmail(opts: {
  toEmail: string;
  customerName: string;
  orderTitle: string;
  appointmentDateDisplay: string;
  appointmentTimeDisplay: string;
  businessAddress: string;
  pickupInstructions: string;
  hoursUntil: 24 | 2 | 1;
  rescheduleUrl: string;
  forceDemo?: boolean;
  kind?: "pickup" | "delivery";
  deliveryAddress?: string;
}) {
  const isDelivery = opts.kind === "delivery";
  const noun = isDelivery ? "delivery" : "pickup";
  const timeframe = opts.hoursUntil === 24 ? "tomorrow" : opts.hoursUntil === 1 ? "in about an hour" : "in about 2 hours";
  const html = shell({
    preheader: `Reminder: ${noun} ${timeframe}`,
    bodyHtml: `
      <p style="margin: 0 0 16px;">Hi ${opts.customerName},</p>
      <p style="margin: 0 0 16px;">
        Just a reminder — your ${noun} for <strong>${opts.orderTitle}</strong> is ${timeframe}:
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 16px;">
        <tr>
          <td style="background-color: #F6EBDD; border-radius: 8px; padding: 16px;">
            <div style="font-size: 18px; font-weight: bold; color: #1E3A5F; font-family: Georgia, serif;">
              ${opts.appointmentDateDisplay} at ${opts.appointmentTimeDisplay}
            </div>
            ${isDelivery
              ? `<div style="margin-top: 10px; color: #74655B; font-size: 14px;">Delivering to: ${escapeHtml(opts.deliveryAddress || "your delivery address")}</div>`
              : `<div style="margin-top: 10px; color: #74655B; font-size: 14px;">${opts.businessAddress}</div>
                 <div style="margin-top: 6px; color: #74655B; font-size: 14px;">${opts.pickupInstructions}</div>`}
          </td>
        </tr>
      </table>
      <p style="margin: 0; font-size: 13px; color: #8a7a6b;">Can't make it? Use the button below to pick a new time.</p>
    `,
    buttonText: isDelivery ? "Reschedule Delivery" : "Reschedule Pickup",
    buttonUrl: opts.rescheduleUrl
  });

  return sendViaResend({
    emailType: "sendPickupReminderEmail",
    orderId: (opts as any).orderId,
    forceDemo: opts.forceDemo,
    from: FROM,
    to: opts.toEmail,
    subject: `Reminder: ${noun} ${timeframe} for ${opts.orderTitle}`,
    html
  });
}

// Simple {{token}} substitution — the admin writes the subject/heading/body
// themselves in the campaign builder, and this fills in the dynamic parts
// per recipient. Nothing about a specific coupon or customer is hardcoded
// here; every value comes from the campaign/coupon record and the one
// customer this particular email is being built for.
function fillCampaignTokens(text: string, tokens: Record<string, string>): string {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) => tokens[key] ?? match);
}

export async function sendCampaignEmail(opts: {
  toEmail: string;
  customerFirstName: string;
  emailSubject: string;
  emailHeading: string;
  emailBody: string; // may contain {{first_name}}, {{coupon_code}}, {{discount}}, {{expiration_date}}, {{applies_to}}
  couponCode: string;
  discountDisplay: string; // e.g. "15% off" or "$10 off", computed by the caller
  expirationDisplay?: string; // e.g. "October 31, 2026", omitted if the coupon has no expiration
  appliesToDisplay: string; // e.g. "Planter Boxes" or "your entire order"
  isPreview?: boolean;
  contactPhone?: string;
  contactEmail?: string;
}) {
  const tokens = {
    first_name: opts.customerFirstName,
    coupon_code: opts.couponCode,
    discount: opts.discountDisplay,
    expiration_date: opts.expirationDisplay || "",
    applies_to: opts.appliesToDisplay
  };

  const subject = fillCampaignTokens(opts.emailSubject, tokens);
  const heading = fillCampaignTokens(opts.emailHeading, tokens);
  // Body is plain admin-written text — paragraphs preserved, but not
  // treated as HTML, so nothing the admin types can break the layout.
  const bodyHtml = fillCampaignTokens(opts.emailBody, tokens)
    .split("\n").filter(line => line.trim().length > 0)
    .map(line => `<p style="margin: 0 0 14px;">${escapeHtml(line)}</p>`)
    .join("");

  const html = shell({
    preheader: heading,
    contactPhone: opts.contactPhone,
    contactEmail: opts.contactEmail,
    bodyHtml: `
      <h1 style="margin: 0 0 20px; font-family: Georgia, 'Times New Roman', serif; font-size: 22px; color: #1E3A5F;">${escapeHtml(heading)}</h1>
      ${bodyHtml}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 20px 0;">
        <tr>
          <td style="background-color: #F6EBDD; border-radius: 8px; padding: 16px; text-align: center;">
            <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.03em; color: #8a7a6b; margin-bottom: 6px;">Your Code</div>
            <div style="font-size: 24px; font-weight: bold; color: #A63D2F; font-family: Georgia, 'Times New Roman', serif; letter-spacing: 0.05em;">${escapeHtml(opts.couponCode)}</div>
            <div style="margin-top: 10px; font-size: 13px; color: #74655B;">
              Just mention this code when you place your next order and we'll apply your discount — no account or login needed.
            </div>
            ${opts.expirationDisplay ? `<div style="margin-top: 6px; font-size: 12px; color: #8a7a6b;">Valid through ${escapeHtml(opts.expirationDisplay)}</div>` : ""}
          </td>
        </tr>
      </table>
    `
  });

  return sendViaResend({
    emailType: "sendCampaignEmail",
    from: FROM,
    to: opts.toEmail,
    subject: opts.isPreview ? `[PREVIEW] ${subject}` : subject,
    html
  });
}

