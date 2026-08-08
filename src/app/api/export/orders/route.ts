import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { toCsv } from "@/lib/csv";
import { productLabel, statusLabel, ProductType } from "@/lib/statusSteps";

export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: adminProfile } = await supabase.from("profiles").select("role").eq("id", user?.id).single();

  if (adminProfile?.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { data: orders } = await supabase
    .from("orders")
    .select("*, profiles:customer_id(full_name, email)")
    .order("created_at", { ascending: false });

  const rows: (string | number)[][] = [
    ["Order title", "Product type", "Customer", "Email", "Status", "Placed", "Due date", "Sales", "Paid", "Owed"]
  ];

  (orders || []).forEach((o: any) => {
    rows.push([
      o.title,
      productLabel(o.product_type as ProductType),
      o.profiles?.full_name || "",
      o.profiles?.email || "",
      statusLabel(o.product_type as ProductType, o.status),
      new Date(o.created_at).toLocaleDateString(),
      o.due_date || "",
      ((o.price_cents || 0) / 100).toFixed(2),
      ((o.amount_paid_cents || 0) / 100).toFixed(2),
      (((o.price_cents || 0) - (o.amount_paid_cents || 0)) / 100).toFixed(2)
    ]);
  });

  const csv = toCsv(rows);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="orders-export.csv"`
    }
  });
}
