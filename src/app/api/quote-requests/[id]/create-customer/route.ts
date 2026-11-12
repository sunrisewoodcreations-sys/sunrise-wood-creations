import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { findOrCreateCustomerForRequest } from "@/lib/quoteRequestCustomer";

// "Create customer" button on a website quote request: makes (or finds) the
// customer record from the request's name / email / phone so they show up
// under Customers. Sends nothing to the person.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: adminProfile } = await supabase.from("profiles").select("role").eq("id", user?.id).single();
  if (adminProfile?.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: request } = await admin.from("quote_requests").select("*").eq("id", params.id).maybeSingle();
  if (!request) return NextResponse.json({ error: "Quote request not found" }, { status: 404 });

  const result = await findOrCreateCustomerForRequest(admin, request);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true, customerId: result.id, created: result.created });
}
