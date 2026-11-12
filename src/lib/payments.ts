// Payments on an order. Each payment has its own amount and method, so an
// order can be paid in pieces (deposit by Venmo, the rest in cash). The
// running total stays in orders.amount_paid_cents so every other screen,
// email and report keeps working unchanged.

export const PAYMENT_METHODS = ["cash", "card", "check", "venmo", "zelle"] as const;

export interface OrderPayment {
  id?: string;
  amount_cents: number;
  method: string | null;
  reference: string | null;
  paid_at?: string;
}

export interface PaymentInput { amountCents: number; method: string | null; reference: string }

// Returns a clean payment or an error message to show the admin.
export function validatePaymentInput(raw: any): { ok: true; value: PaymentInput } | { ok: false; error: string } {
  const amountCents = Math.round(Number(raw?.amountCents));
  if (!Number.isFinite(amountCents) || amountCents <= 0) return { ok: false, error: "Enter how much was paid." };
  const method = raw?.method ? String(raw.method) : null;
  if (method && !(PAYMENT_METHODS as readonly string[]).includes(method)) return { ok: false, error: "Invalid payment method." };
  if (!method) return { ok: false, error: "Choose how they paid." };
  const reference = typeof raw?.reference === "string" ? raw.reference.trim().slice(0, 100) : "";
  if ((method === "venmo" || method === "zelle") && !reference) {
    return { ok: false, error: `Enter the ${method === "venmo" ? "Venmo" : "Zelle"} transaction number.` };
  }
  return { ok: true, value: { amountCents, method, reference: method === "cash" ? "" : reference } };
}

// Recomputes orders.amount_paid_cents (and the "latest" method/reference kept
// for older screens) from the payment rows.
export async function syncOrderPaid(admin: any, orderId: string): Promise<number> {
  const { data } = await admin.from("order_payments").select("amount_cents, method, reference, paid_at").eq("order_id", orderId).order("paid_at", { ascending: true });
  const rows: OrderPayment[] = data || [];
  const total = rows.reduce((s, p) => s + (p.amount_cents || 0), 0);
  const last = rows[rows.length - 1];
  await admin.from("orders").update({
    amount_paid_cents: total,
    payment_method: last?.method || null,
    payment_reference: last?.reference || null
  }).eq("id", orderId);
  return total;
}

// For the invoice: the lines to print under the meta block (max 3 rows).
export function paymentLinesForInvoice(
  payments: { amount_cents: number; method: string | null; reference: string | null }[],
  labels: Record<string, string>
): { label: string; cents: number }[] {
  const lines = payments.map(p => {
    const name = labels[p.method || ""] || "Payment";
    const ref = p.reference ? ` #${p.reference.length > 10 ? p.reference.slice(0, 10) + ".." : p.reference}` : "";
    return { label: name + ref, cents: p.amount_cents };
  });
  if (lines.length <= 3) return lines;
  const rest = lines.slice(2);
  return [...lines.slice(0, 2), { label: `${rest.length} more payments`, cents: rest.reduce((s, l) => s + l.cents, 0) }];
}
