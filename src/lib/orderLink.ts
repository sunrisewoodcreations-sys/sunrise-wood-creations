import { createHmac, timingSafeEqual } from "crypto";

// A "View your order" link that works without logging in. The link carries the
// order id plus a signature only this server can produce, so it can't be
// guessed or edited to open someone else's order. No database change needed.
// (Set ORDER_LINK_SECRET in Vercel to use your own secret; otherwise a secret
// the server already has is used.)
function secret(): string {
  return process.env.ORDER_LINK_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
}

function sign(orderId: string): string {
  return createHmac("sha256", secret()).update(`order-view:${orderId}`).digest("base64url").slice(0, 32);
}

export function signOrderToken(orderId: string): string {
  return `${orderId}.${sign(orderId)}`;
}

// Returns the order id when the token is genuine, otherwise null.
export function verifyOrderToken(token: string | undefined | null): string | null {
  if (!token || !secret()) return null;
  const dot = token.lastIndexOf(".");
  if (dot < 1) return null;
  const orderId = token.slice(0, dot);
  const given = Buffer.from(token.slice(dot + 1));
  const expected = Buffer.from(sign(orderId));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  return orderId;
}

export function orderViewUrl(siteUrl: string, orderId: string): string {
  // Without a secret nothing could be signed, so fall back to the normal
  // (login-required) account link rather than send a link that can't open.
  if (!secret()) return `${siteUrl}/account/orders/${orderId}`;
  return `${siteUrl}/order/${signOrderToken(orderId)}`;
}
