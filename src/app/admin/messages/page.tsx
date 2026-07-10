import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import StartNewChatPicker from "@/components/StartNewChatPicker";
import { productLabel, ProductType } from "@/lib/statusSteps";

export default async function MessagesPage() {
  const supabase = createClient();

  const { data: customers } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("role", "customer")
    .order("full_name");

  // Pull every message along with its order + customer, then collapse
  // down to one row per order (the most recent message), sorted so the
  // most recently active conversations show up first.
  const { data: messages } = await supabase
    .from("order_messages")
    .select("id, order_id, sender_role, body, created_at, orders:order_id(id, title, product_type, customer_id, profiles:customer_id(full_name))")
    .order("created_at", { ascending: false });

  const latestByOrder = new Map<string, any>();
  (messages || []).forEach((m: any) => {
    if (!latestByOrder.has(m.order_id)) {
      latestByOrder.set(m.order_id, m);
    }
  });

  const conversations = Array.from(latestByOrder.values());

  return (
    <div>
      <h1 className="font-display text-2xl text-[#1E3A5F] mb-1">Messages</h1>
      <p className="text-sm text-[#1E3A5F]/60 mb-6">Every conversation with a customer, across all their orders.</p>

      <StartNewChatPicker customers={customers || []} />

      <div className="bg-white border border-[#1E3A5F]/10 rounded-xl overflow-hidden">
        {conversations.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-[#1E3A5F]/50">No conversations yet.</p>
        )}
        {conversations.map((m: any) => {
          const order = m.orders;
          const customerName = order?.profiles?.full_name || "Unknown customer";
          return (
            <Link
              key={m.order_id}
              href={`/admin/orders/${m.order_id}`}
              className="flex items-center justify-between px-4 py-3 border-t border-[#1E3A5F]/10 first:border-0 hover:bg-cream/60"
            >
              <div>
                <div className="text-sm font-semibold text-[#1E3A5F]">
                  {customerName} — {order ? `${productLabel(order.product_type as ProductType)}: ${order.title}` : "Order"}
                </div>
                <div className="text-xs text-[#1E3A5F]/60 truncate max-w-md">
                  {m.sender_role === "admin" ? "You: " : ""}{m.body}
                </div>
              </div>
              <div className="text-xs font-mono text-[#1E3A5F]/40 whitespace-nowrap ml-4">
                {new Date(m.created_at).toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric" })}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
