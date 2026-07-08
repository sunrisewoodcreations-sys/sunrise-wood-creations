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
