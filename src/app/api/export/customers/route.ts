import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isDemoAccountRequest } from "@/lib/demoMode";
import { toCsv } from "@/lib/csv";

export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: adminProfile } = await supabase.from("profiles").select("role").eq("id", user?.id).single();

  if (adminProfile?.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  // Same demo isolation already used on the Customers list page — this
  // was missing here, which meant a real admin's export could include
  // test customers, and the demo account's export could include real
  // ones. Matches the exact same fix already applied to the Orders
  // page's customer picker earlier in this project.
  const isDemoAccount = await isDemoAccountRequest();

  const { data: customers } = await supabase
    .from("profiles")
    .select("id, full_name, email, has_real_email, orders:orders(price_cents, amount_paid_cents)")
    .eq("role", "customer")
    .eq("is_demo", isDemoAccount)
    .order("full_name");

  const rows: (string | number)[][] = [
    ["Name", "Email", "Orders", "Total sales", "Total paid", "Owed"]
  ];

  (customers || []).forEach((c: any) => {
    const orders = c.orders || [];
    const sales = orders.reduce((s: number, o: any) => s + (o.price_cents || 0), 0) / 100;
    const paid = orders.reduce((s: number, o: any) => s + (o.amount_paid_cents || 0), 0) / 100;
    // Same has_real_email check already used everywhere else this is
    // displayed — without it, the raw internal placeholder address
    // (no-email-xxxx@no-account...) would leak into the file instead
    // of something readable.
    const displayEmail = c.has_real_email === false ? "No email on file" : c.email;
    rows.push([c.full_name, displayEmail, orders.length, sales.toFixed(2), paid.toFixed(2), (sales - paid).toFixed(2)]);
  });

  const csv = toCsv(rows);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="customers-export.csv"`
    }
  });
}
