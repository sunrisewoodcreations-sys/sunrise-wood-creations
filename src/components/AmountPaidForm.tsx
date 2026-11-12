"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PaymentEntry from "@/components/PaymentEntry";

const LABELS: Record<string, string> = { cash: "Cash", card: "Credit / debit card", check: "Check", venmo: "Venmo", zelle: "Zelle" };

export interface PaymentRow { id: string; amount_cents: number; method: string | null; reference: string | null; paid_at: string }

export default function AmountPaidForm({
  orderId, priceCents, initialAmountPaidCents, payments
}: {
  orderId: string;
  priceCents: number;
  initialAmountPaidCents: number;
  payments: PaymentRow[];
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);

  const total = priceCents / 100;
  const paid = initialAmountPaidCents / 100;
  const due = total - paid;

  async function remove(id: string) {
    if (!window.confirm("Remove this payment?")) return;
    setError("");
    const res = await fetch(`/api/orders/${orderId}/payments?paymentId=${id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
    else setError((await res.json().catch(() => ({}))).error || "Couldn't remove that.");
  }

  return (
    <div className="bg-cream border border-[#1E3A5F]/10 rounded-lg p-4 mt-4">
      <div className="grid grid-cols-3 gap-4 mb-3 text-sm">
        <div>
          <div className="text-[#1E3A5F]/50 text-xs mb-1">Total</div>
          <div className="font-semibold text-[#1E3A5F]">${total.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-[#1E3A5F]/50 text-xs mb-1">Amount paid</div>
          <div className="font-semibold text-[#1E3A5F]">${paid.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-[#1E3A5F]/50 text-xs mb-1">Still owed</div>
          <div className={`font-semibold ${due > 0 ? "text-ember" : "text-sage"}`}>${due.toFixed(2)}</div>
        </div>
      </div>

      {payments.length > 0 ? (
        <ul className="mb-3 divide-y divide-[#1E3A5F]/10 border border-[#1E3A5F]/10 rounded-md bg-white text-sm">
          {payments.map(p => (
            <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <div className="min-w-0">
                <span className="font-semibold text-[#1E3A5F]">${(p.amount_cents / 100).toFixed(2)}</span>
                <span className="text-[#1E3A5F]/70"> · {LABELS[p.method || ""] || "Method not recorded"}</span>
                {p.reference && <span className="text-[#1E3A5F]/50 text-xs"> · #{p.reference}</span>}
                <div className="text-[#1E3A5F]/40 text-xs">{new Date(p.paid_at).toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric" })}</div>
              </div>
              <button type="button" onClick={() => remove(p.id)} className="text-xs text-ember shrink-0">Remove</button>
            </li>
          ))}
        </ul>
      ) : paid > 0 ? (
        <p className="text-xs text-[#1E3A5F]/50 mb-3">${paid.toFixed(2)} paid (no payment details recorded).</p>
      ) : null}

      {error && <p className="text-ember text-xs mb-2">{error}</p>}

      {adding ? (
        <PaymentEntry
          orderId={orderId}
          defaultAmount={due > 0 ? due.toFixed(2) : ""}
          buttonLabel="Save payment"
          onSaved={() => { setAdding(false); router.refresh(); }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="bg-[#1E3A5F] text-white px-4 py-1.5 rounded-md text-xs font-semibold">
          + Add payment
        </button>
      )}
    </div>
  );
}
