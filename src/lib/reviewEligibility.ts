import { createAdminClient } from "@/lib/supabase/admin";

// The one place that decides whether a customer is actually allowed to
// review a given order_item — used by both the eligibility list (My
// Reviews) and the submit/edit route, so there's exactly one
// definition of "eligible," not two that could quietly drift apart.
//
// Deliberately a two-step query (orders first, then order_items)
// rather than a single nested-filter query — .eq() and .in() on plain
// columns are patterns already proven correct everywhere else in this
// project; a joined-table filter syntax is not something I want to
// trust without being certain of it.
export async function getEligibleOrderItem(orderItemId: string, customerId: string) {
  const admin = createAdminClient();

  const { data: item } = await admin
    .from("order_items")
    .select("id, title, order_id")
    .eq("id", orderItemId)
    .maybeSingle();
  if (!item) return null;

  const { data: order } = await admin
    .from("orders")
    .select("id, customer_id, status")
    .eq("id", item.order_id)
    .eq("customer_id", customerId)
    .eq("status", "picked_up")
    .maybeSingle();
  if (!order) return null;

  return item;
}

// Every order_item this customer is eligible to review, regardless of
// whether they've already reviewed it — the caller (My Reviews page)
// cross-references this against existing reviews to show status per item.
export async function getAllEligibleOrderItems(customerId: string) {
  const admin = createAdminClient();

  const { data: pickedUpOrders } = await admin
    .from("orders")
    .select("id")
    .eq("customer_id", customerId)
    .eq("status", "picked_up");

  const orderIds = (pickedUpOrders || []).map((o: any) => o.id);
  if (orderIds.length === 0) return [];

  const { data: items } = await admin
    .from("order_items")
    .select("id, title, order_id")
    .in("order_id", orderIds);

  return items || [];
}

