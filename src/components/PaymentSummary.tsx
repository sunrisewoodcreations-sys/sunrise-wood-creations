// Shows total / paid / balance owed for an order, using the running
// totals that already exist (price_cents, amount_paid_cents) — no
// database changes needed for this.
//
// Forward-compatible on purpose: `payments` is an optional itemized
// list (date + amount) that doesn't exist as a real data source yet.
// When a proper payment-history table gets built later, the caller
// just needs to fetch and pass that list in here — this component
// already knows how to render it below the summary. Nothing about the
// Customer Portal pages themselves will need to change at that point.
export default function PaymentSummary({
  priceCents,
  amountPaidCents,
  payments
}: {
  priceCents: number;
  amountPaidCents: number;
  payments?: { date: string; amountCents: number }[];
}) {
  const balanceCents = priceCents - amountPaidCents;
  const isPaidInFull = balanceCents <= 0;

  return (
    <div className="border border-walnut/10 rounded-lg p-4 mb-4">
      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <div className="text-[10px] text-walnut/50 uppercase tracking-wide font-semibold mb-1">Total</div>
          <div className="text-base font-display text-walnut">${(priceCents / 100).toFixed(2)}</div>
        </div>
        <div>
          <div className="text-[10px] text-walnut/50 uppercase tracking-wide font-semibold mb-1">Paid</div>
          <div className="text-base font-display text-sage">${(amountPaidCents / 100).toFixed(2)}</div>
        </div>
        <div>
          <div className="text-[10px] text-walnut/50 uppercase tracking-wide font-semibold mb-1">Balance owed</div>
          <div className={`text-base font-display font-semibold ${isPaidInFull ? "text-sage" : "text-ember"}`}>
            ${Math.max(0, balanceCents / 100).toFixed(2)}
          </div>
        </div>
      </div>

      {/* Future extension point — renders nothing today since no page
          passes `payments` in yet. Once a real payment-history table
          exists, passing that data here is the only change needed. */}
      {payments && payments.length > 0 && (
        <div className="mt-3 pt-3 border-t border-walnut/10 space-y-1">
          <div className="text-[10px] text-walnut/50 uppercase tracking-wide font-semibold mb-1">Payment history</div>
          {payments.map((p, i) => (
            <div key={i} className="flex justify-between text-xs text-walnut/70">
              <span>{new Date(p.date).toLocaleDateString()}</span>
              <span>${(p.amountCents / 100).toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
