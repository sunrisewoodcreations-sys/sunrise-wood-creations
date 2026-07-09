import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { issueInvoiceForOrder } from "@/lib/invoice";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: adminProfile } = await supabase.from("profiles").select("role").eq("id", user?.id).single();

  if (adminProfile?.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { data: order } = await supabase
    .from("orders")
    .select("*, profiles:customer_id(email, full_name)")
    .eq("id", params.id)
    .single();

  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const customer = (order as any).profiles;

  try {
    await issueInvoiceForOrder(order, customer);
  } catch (err) {
    console.error("Manual invoice send failed:", err);
    return NextResponse.json({ error: "Invoice failed to send" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
