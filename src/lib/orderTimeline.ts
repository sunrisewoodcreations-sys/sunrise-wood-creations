import { createClient } from "@/lib/supabase/server";
import { statusLabel, ProductType } from "@/lib/statusSteps";

export type TimelineEvent = {
  timestamp: string;
  type: string;
  label: string;
  detail?: string;
  icon: string;
  color: string;
  orderId?: string;
  orderLabel?: string;
};

// Builds the full audit trail for one order by reading from tables that
// already exist and already get written to by other flows in the app —
// nothing here creates new data or duplicates any existing logic, it
// only reads and merges what's already being recorded:
//   - orders.created_at            -> Order created
//   - quote_requests.converted_order_id -> Quote accepted (if this order came from one)
//   - order_status_history         -> every status change, old -> new
//   - invoices.sent_at             -> Invoice sent
//   - order_messages               -> customer/staff messages
//   - proofs.sent_at / responded_at -> design proof uploaded / approved / changes requested
//
// Two items on the original wishlist have no real data source yet and
// are deliberately left out rather than faked: itemized payment
// history (only a running total exists today, matching the same
// forward-compatible design already used for the Payment Summary on
// the Customer Portal) and due-date change history (no log of past
// values exists). Both slot in cleanly later — add the query, push
// events into this same array, nothing else about this file changes.
export async function getOrderTimeline(orderId: string): Promise<TimelineEvent[]> {
  const supabase = createClient();
  const events: TimelineEvent[] = [];

  const { data: order } = await supabase
    .from("orders")
    .select("created_at, product_type")
    .eq("id", orderId)
    .single();

  if (!order) return [];

  events.push({
    timestamp: order.created_at,
    type: "order_created",
    label: "Order created",
    icon: "box",
    color: "text-[#1E3A5F]"
  });

  const { data: quote } = await supabase
    .from("quote_requests")
    .select("created_at")
    .eq("converted_order_id", orderId)
    .maybeSingle();

  if (quote) {
    events.push({
      timestamp: order.created_at,
      type: "quote_accepted",
      label: "Quote accepted",
      detail: "Converted from a customer quote request",
      icon: "check-circle",
      color: "text-sage"
    });
  }

  const { data: statusHistory } = await supabase
    .from("order_status_history")
    .select("status, created_at")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });

  // Skip the first row — it's the same moment as "Order created" above,
  // just recorded a second time by the status-logging trigger.
  (statusHistory || []).slice(1).forEach((row: any, i: number) => {
    const prevStatus = (statusHistory || [])[i].status; // i is the index into the ORIGINAL array's previous element
    const newLabel = statusLabel(order.product_type as ProductType, row.status);
    const oldLabel = statusLabel(order.product_type as ProductType, prevStatus);
    events.push({
      timestamp: row.created_at,
      type: "status_changed",
      label:
        row.status === "ready_for_pickup" ? "Marked ready for pickup" :
        row.status === "picked_up" ? "Order picked up / completed" :
        `Status changed to ${newLabel}`,
      detail: `${oldLabel} → ${newLabel}`,
      icon: row.status === "picked_up" ? "check-circle" : "hammer",
      color: row.status === "picked_up" ? "text-sage" : "text-amber"
    });
  });

  const { data: invoices } = await supabase
    .from("invoices")
    .select("invoice_number, sent_at, paid_in_full")
    .eq("order_id", orderId)
    .not("sent_at", "is", null);

  (invoices || []).forEach((inv: any) => {
    events.push({
      timestamp: inv.sent_at,
      type: "invoice_sent",
      label: `Invoice #${inv.invoice_number} sent`,
      detail: inv.paid_in_full ? "Paid in full" : undefined,
      icon: "dollar",
      color: "text-ember"
    });
  });

  const { data: messages } = await supabase
    .from("order_messages")
    .select("sender_role, body, created_at")
    .eq("order_id", orderId);

  (messages || []).forEach((m: any) => {
    events.push({
      timestamp: m.created_at,
      type: m.sender_role === "admin" ? "staff_message" : "customer_message",
      label: m.sender_role === "admin" ? "Staff message sent" : "Customer message received",
      detail: m.body.length > 80 ? `${m.body.slice(0, 80)}…` : m.body,
      icon: "message",
      color: m.sender_role === "admin" ? "text-[#1E3A5F]" : "text-ember"
    });
  });

  const { data: proofs } = await supabase
    .from("proofs")
    .select("status, feedback, sent_at, responded_at")
    .eq("order_id", orderId);

  (proofs || []).forEach((p: any) => {
    events.push({
      timestamp: p.sent_at,
      type: "proof_uploaded",
      label: "Design proof uploaded",
      icon: "layers",
      color: "text-amber"
    });
    if (p.responded_at) {
      events.push({
        timestamp: p.responded_at,
        type: p.status === "approved" ? "proof_approved" : "proof_changes_requested",
        label: p.status === "approved" ? "Design proof approved" : "Changes requested on design proof",
        detail: p.feedback || undefined,
        icon: p.status === "approved" ? "check-circle" : "message",
        color: p.status === "approved" ? "text-sage" : "text-ember"
      });
    }
  });

  return events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

// Combines the same per-order timeline above across every order a
// customer has ever placed, into one chronological history — this is
// the CRM-style "everything that's ever happened with this customer"
// view. Reuses getOrderTimeline() for each order rather than
// re-implementing any of its event-sourcing logic; this function only
// adds which order each event belongs to, then merges and re-sorts.
export async function getCustomerTimeline(
  orders: { id: string; title: string; product_type: string }[]
): Promise<TimelineEvent[]> {
  const perOrderEvents = await Promise.all(
    orders.map(async order => {
      const events = await getOrderTimeline(order.id);
      return events.map(ev => ({
        ...ev,
        orderId: order.id,
        orderLabel: order.title
      }));
    })
  );

  return perOrderEvents
    .flat()
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}
