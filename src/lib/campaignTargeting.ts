import { createAdminClient } from "@/lib/supabase/admin";

export type TargetingType = "all" | "product_type" | "product" | "date_range" | "manual";

export type TargetingSpec = {
  type: TargetingType;
  productType?: string;
  productId?: string;
  startDate?: string;
  endDate?: string;
  customerIds?: string[];
  // Individual customers the admin deselected from an auto-matched list
  // (category/product/date-range/all) — persisted here so the actual
  // send genuinely excludes them, not just the live preview shown while
  // building the campaign.
  excludedCustomerIds?: string[];
};

export type MatchedCustomer = { id: string; full_name: string; email: string; phone: string | null };

// The one place "customers who purchased X" is actually computed — checks
// both orders.product_type (the common single-item case) and
// order_items.product_type (multi-item orders), since either can carry
// the real purchase history depending on how the order was built.
export async function getMatchingCustomers(spec: TargetingSpec): Promise<MatchedCustomer[]> {
  const admin = createAdminClient();
  const excluded = new Set(spec.excludedCustomerIds || []);
  const applyExclusions = (customers: MatchedCustomer[]) => excluded.size > 0 ? customers.filter(c => !excluded.has(c.id)) : customers;

  if (spec.type === "manual") {
    if (!spec.customerIds || spec.customerIds.length === 0) return [];
    const { data } = await admin
      .from("profiles").select("id, full_name, email, phone")
      .in("id", spec.customerIds).eq("role", "customer");
    return data || [];
  }

  if (spec.type === "all") {
    const { data } = await admin
      .from("profiles").select("id, full_name, email, phone")
      .eq("role", "customer").eq("is_demo_account", false);
    return applyExclusions(data || []);
  }

  // product_type, product, and date_range all work by first finding which
  // real customers have a matching order, then loading those profiles.
  let orderQuery = admin.from("orders").select("customer_id").eq("is_demo", false);
  if (spec.type === "product_type" && spec.productType) orderQuery = orderQuery.eq("product_type", spec.productType);
  if (spec.type === "product" && spec.productId) orderQuery = orderQuery.eq("product_id", spec.productId);
  if (spec.type === "date_range") {
    if (spec.startDate) orderQuery = orderQuery.gte("created_at", spec.startDate);
    if (spec.endDate) orderQuery = orderQuery.lte("created_at", `${spec.endDate}T23:59:59`);
  }
  const { data: matchingOrders } = await orderQuery;

  const customerIdSet = new Set<string>();
  (matchingOrders || []).forEach((o: any) => { if (o.customer_id) customerIdSet.add(o.customer_id); });

  // Also check order_items, for orders whose individual line items carry
  // the product type/id rather than (or in addition to) the order itself.
  if (spec.type === "product_type" || spec.type === "product") {
    let itemQuery = admin.from("order_items").select("order_id, product_type, product_id, orders:order_id(customer_id, is_demo)");
    if (spec.type === "product_type" && spec.productType) itemQuery = itemQuery.eq("product_type", spec.productType);
    if (spec.type === "product" && spec.productId) itemQuery = itemQuery.eq("product_id", spec.productId);
    const { data: matchingItems } = await itemQuery;
    (matchingItems || []).forEach((it: any) => {
      if (it.orders && !it.orders.is_demo && it.orders.customer_id) customerIdSet.add(it.orders.customer_id);
    });
  }

  if (customerIdSet.size === 0) return [];
  const { data } = await admin
    .from("profiles").select("id, full_name, email, phone")
    .in("id", Array.from(customerIdSet)).eq("role", "customer");
  return applyExclusions(data || []);
}

// Powers the "Customers who purchased:" checklist with live counts —
// one call per category, reusing the same matching logic above.
export async function getCustomerCountsByProductType(): Promise<Record<string, number>> {
  const types = ["cornhole", "sign", "planter", "cutting_board"];
  const counts: Record<string, number> = {};
  await Promise.all(types.map(async t => {
    const matched = await getMatchingCustomers({ type: "product_type", productType: t });
    counts[t] = matched.length;
  }));
  return counts;
}

// Individual customer search (name/email/phone) for manual selection —
// same profiles table already used everywhere else, no new customer data.
export async function searchCustomers(query: string): Promise<MatchedCustomer[]> {
  const admin = createAdminClient();
  const q = query.trim();
  if (!q) return [];
  const { data } = await admin
    .from("profiles").select("id, full_name, email, phone")
    .eq("role", "customer")
    .or(`full_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`)
    .limit(50);
  return data || [];
}

// Applied at the final recipient-list step (preview and actual send) —
// removes anyone already recorded as sent for this exact campaign, so
// re-opening a draft and sending again never double-emails someone.
export async function excludeAlreadySent(campaignId: string, customers: MatchedCustomer[]): Promise<MatchedCustomer[]> {
  if (customers.length === 0) return customers;
  const admin = createAdminClient();
  const { data: alreadySent } = await admin
    .from("campaign_recipients")
    .select("customer_id")
    .eq("campaign_id", campaignId)
    .not("email_sent_at", "is", null);
  const sentIds = new Set((alreadySent || []).map((r: any) => r.customer_id));
  return customers.filter(c => !sentIds.has(c.id));
}
