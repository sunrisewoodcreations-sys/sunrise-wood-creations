import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendNewMessageNotice, sendCustomerNewMessageNotice } from "@/lib/email";

// Both admin and the order's own customer can read/send here — RLS on
// the order_messages table already enforces who's allowed to see what,
// this route just adds the notification email on top.

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();

  // Only mark shop messages as read when the client tells us the page is
  // actually visible/foregrounded on the customer's screen — a background
  // tab silently polling for new messages shouldn't count as "read".
  const shouldMarkRead = req.nextUrl.searchParams.get("markRead") === "1";

  if (profile?.role !== "admin" && shouldMarkRead) {
    await supabase
      .from("order_messages")
      .update({ read_at: new Date().toISOString() })
      .eq("order_id", params.id)
      .eq("sender_role", "admin")
      .is("read_at", null);
  }

  const { data: messages, error } = await supabase
    .from("order_messages")
    .select("*")
    .eq("order_id", params.id)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ messages: messages || [] });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const { body: messageBody } = await req.json();
  if (!messageBody?.trim()) {
    return NextResponse.json({ error: "Message can't be empty" }, { status: 400 });
  }

  const { data: profile } = await supabase.from("profiles").select("role, full_name").eq("id", user.id).single();
  const senderRole = profile?.role === "admin" ? "admin" : "customer";

  const { data: message, error } = await supabase
    .from("order_messages")
    .insert({
      order_id: params.id,
      sender_id: user.id,
      sender_role: senderRole,
      body: messageBody.trim()
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Let the other side know a new message came in — the shop when a
  // customer messages, and the customer when the shop replies.
  if (senderRole === "customer") {
    try {
      const { data: order } = await supabase.from("orders").select("id, title").eq("id", params.id).single();
      if (order) {
        await sendNewMessageNotice({
          orderTitle: order.title,
          orderId: order.id,
          customerName: profile?.full_name || "A customer",
          messageBody: messageBody.trim()
        });
      }
    } catch (err) {
      console.error("New-message notice failed to send:", err);
    }
  } else {
    try {
      const { data: order } = await supabase
        .from("orders")
        .select("id, title, profiles:customer_id(email, full_name)")
        .eq("id", params.id)
        .single();
      const customer = (order as any)?.profiles;
      if (order && customer?.email) {
        await sendCustomerNewMessageNotice({
          toEmail: customer.email,
          customerName: customer.full_name || "there",
          orderTitle: order.title,
          orderId: order.id,
          messageBody: messageBody.trim()
        });
      }
    } catch (err) {
      console.error("Customer new-message notice failed to send:", err);
    }
  }

  return NextResponse.json({ ok: true, message });
}
