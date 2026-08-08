import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { toCsv } from "@/lib/csv";

export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: adminProfile } = await supabase.from("profiles").select("role").eq("id", user?.id).single();

  if (adminProfile?.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { data: customers } = await supabase
    .from("profiles")
    .select("id, full_name, email, orders:orders(price_cents, amount_paid_cents)")
    .eq("role", "customer")
    .order("full_name");

  const rows: (string | number)[][] = [
    ["Name", "Email", "Orders", "Total sales", "Total paid", "Owed"]
  ];

  (customers || []).forEach((c: any) => {
    const orders = c.orders || [];
    const sales = orders.reduce((s: number, o: any) => s + (o.price_cents || 0), 0) / 100;
    const paid = orders.reduce((s: number, o: any) => s + (o.amount_paid_cents || 0), 0) / 100;
    rows.push([c.full_name, c.email, orders.length, sales.toFixed(2), paid.toFixed(2), (sales - paid).toFixed(2)]);
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
