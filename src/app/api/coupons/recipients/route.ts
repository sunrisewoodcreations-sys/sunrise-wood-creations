import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getMatchingCustomers, getCustomerCountsByProductType, searchCustomers, excludeAlreadySent, TargetingSpec } from "@/lib/campaignTargeting";

async function requireAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user?.id).single();
  return profile?.role === "admin";
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const body = await req.json();

  // Powers the "Customers who purchased:" checklist with per-category
  // counts, shown before any single option is even selected.
  if (body.mode === "category_counts") {
    const counts = await getCustomerCountsByProductType();
    return NextResponse.json({ counts });
  }

  // Powers the individual-customer search box.
  if (body.mode === "search") {
    const results = await searchCustomers(body.query || "");
    return NextResponse.json({ customers: results });
  }

  // Standard mode: resolve a targeting spec to its actual matching
  // customers, optionally excluding anyone already sent this exact
  // campaign, then remove anyone the admin has manually deselected.
  const spec: TargetingSpec = body.spec;
  let customers = await getMatchingCustomers(spec);

  if (body.excludeCampaignId && body.excludePreviouslySent) {
    customers = await excludeAlreadySent(body.excludeCampaignId, customers);
  }

  if (Array.isArray(body.deselectedIds) && body.deselectedIds.length > 0) {
    const deselected = new Set(body.deselectedIds);
    customers = customers.filter(c => !deselected.has(c.id));
  }

  return NextResponse.json({ customers, count: customers.length });
}
