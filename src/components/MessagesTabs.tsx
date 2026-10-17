"use client";

import { useState } from "react";
import Link from "next/link";
import { productLabel, ProductType } from "@/lib/statusSteps";
import GuestChatRow from "@/components/GuestChatRow";

export default function MessagesTabs({
  conversations,
  guestMessages
}: {
  conversations: any[];
  guestMessages: any[];
}) {
  const [tab, setTab] = useState<"customer" | "guest">("customer");

  return (
    <div>
      <div className="flex gap-2 mb-5">
        <button
          onClick={() => setTab("customer")}
          className={`px-4 py-2 rounded-md text-sm font-semibold ${tab === "customer" ? "bg-accent text-white" : "border border-[#2E2420]/20 text-[#2E2420]"}`}
        >
          Customer chats
        </button>
        <button
          onClick={() => setTab("guest")}
          className={`px-4 py-2 rounded-md text-sm font-semibold ${tab === "guest" ? "bg-accent text-white" : "border border-[#2E2420]/20 text-[#2E2420]"}`}
        >
          Guest chats (website bubble)
        </button>
      </div>

      {tab === "customer" && (
        <div className="bg-white border border-[#2E2420]/10 rounded-xl shadow-sm overflow-hidden">
          {conversations.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-[#2E2420]/50">No conversations yet.</p>
          )}
          {conversations.map((m: any) => {
            const order = m.orders;
            const customerName = order?.profiles?.full_name || "Unknown customer";
            return (
              <Link
                key={m.order_id}
                href={`/admin/orders/${m.order_id}`}
                className="flex items-center justify-between px-4 py-3 border-t border-[#2E2420]/10 first:border-0 hover:bg-cream/60"
              >
                <div>
                  <div className="text-sm font-semibold text-[#2E2420]">
                    {customerName} — {order ? `${productLabel(order.product_type as ProductType)}: ${order.title}` : "Order"}
                  </div>
                  <div className="text-xs text-[#2E2420]/60 truncate max-w-md">
                    {m.sender_role === "admin" ? "You: " : ""}{m.body}
                  </div>
                </div>
                <div className="text-xs font-mono text-[#2E2420]/40 whitespace-nowrap ml-4">
                  {new Date(m.created_at).toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric" })}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {tab === "guest" && (
        <div className="bg-white border border-[#2E2420]/10 rounded-xl shadow-sm overflow-hidden">
          {guestMessages.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-[#2E2420]/50">No website chat messages yet.</p>
          )}
          {guestMessages.map((g: any) => (
            <GuestChatRow key={g.id} guest={g} />
          ))}
        </div>
      )}
    </div>
  );
}
