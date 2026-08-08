import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Deletes every record flagged is_demo — orders (order_items/proofs/
// invoices/etc. cascade via existing FK constraints, same as deleting
// any real order does), demo customer profiles, and demo quotes.
// Callable by any real admin (not the demo account itself, so a
// tester can never wipe their own test data mid-session and can never
// be tricked into resetting anything by mistake).
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: adminProfile } = await supabase.from("profiles").select("role, is_demo_account").eq("id", user?.id).single();

  if (adminProfile?.role !== "admin" || adminProfile?.is_demo_account) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const admin = createAdminClient();

  const { error: ordersError, count: ordersDeleted } = await admin.from("orders").delete({ count: "exact" }).eq("is_demo", true);
  if (ordersError) return NextResponse.json({ error: `Deleting demo orders: ${ordersError.message}` }, { status: 500 });

  const { error: quotesError, count: quotesDeleted } = await admin.from("quotes").delete({ count: "exact" }).eq("is_demo", true);
  if (quotesError) return NextResponse.json({ error: `Deleting demo quotes: ${quotesError.message}` }, { status: 500 });

  // Demo customer profiles are real Supabase auth users too (created
  // via admin.createUser in the customer-creation route) — deleting
  // just the profile row would leave an orphaned, unusable auth user
  // behind, so both are removed together.
  const { data: demoCustomers } = await admin.from("profiles").select("id").eq("is_demo", true).eq("role", "customer");
  for (const c of demoCustomers || []) {
    await admin.auth.admin.deleteUser(c.id);
  }
  const customersDeleted = (demoCustomers || []).length;

  return NextResponse.json({ ok: true, ordersDeleted: ordersDeleted || 0, quotesDeleted: quotesDeleted || 0, customersDeleted });
}
