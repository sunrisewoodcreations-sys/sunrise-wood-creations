"use client";

import { useState } from "react";

// Reuses the exact same public quote-request endpoint the "Request a
// Quote" page already submits to — a reorder is just a new quote
// request, pre-filled from what was ordered before, not a new kind of
// submission or a direct new order (customers never create orders
// directly; that still only happens via the quote workflow).
export default function ReorderButton({
  customerName,
  customerEmail,
  customerPhone,
  productType,
  title,
  sizeDetails
}: {
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  productType: string;
  title: string;
  sizeDetails: string | null;
}) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function handleReorder() {
    setState("sending");
    const res = await fetch("/api/quote-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: customerName,
        email: customerEmail,
        phone: customerPhone,
        productType,
        dimensions: sizeDetails,
        description: `Reorder request: another ${title}${sizeDetails ? ` (${sizeDetails})` : ""}, same as a previous order.`
      })
    });
    setState(res.ok ? "sent" : "error");
  }

  if (state === "sent") {
    return <span className="text-xs font-semibold text-sage">Reorder request sent — we'll follow up with a quote!</span>;
  }

  return (
    <button
      onClick={handleReorder}
      disabled={state === "sending"}
      className="text-xs font-semibold text-white bg-walnut px-3 py-1.5 rounded-md disabled:opacity-60"
    >
      {state === "sending" ? "Sending..." : state === "error" ? "Try again" : "Reorder this"}
    </button>
  );
}
