"use client";

import { useState } from "react";
import Link from "next/link";
import SendInvoiceButton from "@/components/SendInvoiceButton";
import AmountPaidForm from "@/components/AmountPaidForm";
import { productLabel, ProductType } from "@/lib/statusSteps";

type OrderOption = {
  id: string;
  title: string;
  product_type: string;
  price_cents: number;
  amount_paid_cents: number;
  status: string;
};

export default function CustomerQuickActions({
  orders,
  customerEmail,
  customerName,
  hasRealEmail
}: {
  orders: OrderOption[];
  customerEmail: string;
  customerName: string;
  hasRealEmail: boolean;
}) {
  // Default to the most recent order that's still active and has a
  // balance due — the one you'd most likely want to act on — falling
  // back to the most recent order overall if none qualify.
  const defaultOrder =
    orders.find(o => o.status !== "picked_up" && (o.price_cents || 0) > (o.amount_paid_cents || 0)) ||
    orders[0];

  const [selectedOrderId, setSelectedOrderId] = useState(defaultOrder?.id || "");
  const [showRecordPayment, setShowRecordPayment] = useState(false);

  const selectedOrder = orders.find(o => o.id === selectedOrderId);
  const viewAllOrdersHref = `/admin/orders?q=${encodeURIComponent(hasRealEmail ? customerEmail : customerName)}`;

  return (
    <div className="bg-white border border-[#1E3A5F]/10 rounded-xl shadow-sm p-4 mb-6">
      <div className="text-xs font-semibold text-[#1E3A5F]/50 uppercase tracking-wide mb-3">Quick actions</div>

      <div className="flex flex-wrap gap-2 mb-3">
        {hasRealEmail && (
          <a
            href={`mailto:${customerEmail}`}
            className="border border-[#1E3A5F]/20 text-[#1E3A5F] px-3 py-2 rounded-md text-sm font-semibold hover:bg-cream text-center flex-1 sm:flex-none"
          >
            Email customer
          </a>
        )}
        <Link
          href={viewAllOrdersHref}
          className="border border-[#1E3A5F]/20 text-[#1E3A5F] px-3 py-2 rounded-md text-sm font-semibold hover:bg-cream text-center flex-1 sm:flex-none"
        >
          View all orders
        </Link>
      </div>

      {orders.length > 0 && (
        <div className="border-t border-[#1E3A5F]/10 pt-3">
          <label className="block text-xs font-semibold text-[#1E3A5F] mb-1">For order:</label>
          <select
            value={selectedOrderId}
            onChange={e => { setSelectedOrderId(e.target.value); setShowRecordPayment(false); }}
            className="w-full border border-[#1E3A5F]/15 rounded-md px-3 py-2 text-sm mb-3"
          >
            {orders.map(o => {
              const balance = (o.price_cents || 0) - (o.amount_paid_cents || 0);
              return (
                <option key={o.id} value={o.id}>
                  {productLabel(o.product_type as ProductType)} — {o.title} {balance > 0 ? `($${(balance / 100).toFixed(2)} due)` : "(paid)"}
                </option>
              );
            })}
          </select>

          {selectedOrder && (
            <div className="flex flex-wrap gap-2 items-center">
              <SendInvoiceButton orderId={selectedOrder.id} />
              <button
                onClick={() => setShowRecordPayment(s => !s)}
                className="border border-[#1E3A5F] text-[#1E3A5F] px-3 py-1.5 rounded-md text-xs font-semibold"
              >
                {showRecordPayment ? "Hide payment form" : "Record payment"}
              </button>
            </div>
          )}

          {selectedOrder && showRecordPayment && (
            <AmountPaidForm
              orderId={selectedOrder.id}
              priceCents={selectedOrder.price_cents || 0}
              initialAmountPaidCents={selectedOrder.amount_paid_cents || 0}
            />
          )}
        </div>
      )}
    </div>
  );
}
