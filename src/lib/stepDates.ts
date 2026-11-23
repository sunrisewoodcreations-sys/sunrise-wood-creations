// The dates shown under the order progress steps.
//  - "Order placed" is the Date placed set on the order (orders.created_at).
//  - "Deposit received" is the date of the first payment (the deposit).
// Both follow whatever you edit, instead of the moment the status button was tapped.

// A date typed in the "Date placed" box used to be saved as midnight UTC, which
// is the evening BEFORE in Eastern time. Treat those as the calendar day typed.
export function normalizeDateOnly(iso: string): string {
  return /T00:00:00(\.000)?Z$/.test(iso) ? iso.slice(0, 10) + "T16:00:00.000Z" : iso;
}

export function applyStepDates(
  timestamps: Record<string, string>,
  order: { created_at?: string | null },
  firstPaymentAt?: string | null
): Record<string, string> {
  const out = { ...timestamps };
  if (order.created_at) out.order_placed = normalizeDateOnly(order.created_at);
  if (firstPaymentAt && out.deposit_received) out.deposit_received = normalizeDateOnly(firstPaymentAt);
  return out;
}
