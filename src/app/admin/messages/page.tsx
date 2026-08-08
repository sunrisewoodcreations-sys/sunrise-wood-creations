import { createClient } from "@/lib/supabase/server";
import StartNewChatPicker from "@/components/StartNewChatPicker";
import MessagesTabs from "@/components/MessagesTabs";

export default async function MessagesPage() {
  const supabase = createClient();

  const { data: customers } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("role", "customer")
    .order("full_name");

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

  const { data: guestMessages } = await supabase
    .from("guest_messages")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 className="font-display text-2xl text-[#1E3A5F] mb-1">Messages</h1>
      <p className="text-sm text-[#1E3A5F]/60 mb-6">Customer order chats and website guest chats, in one place.</p>

      <StartNewChatPicker customers={customers || []} />

      <MessagesTabs conversations={conversations} guestMessages={guestMessages || []} />
    </div>
  );
}
