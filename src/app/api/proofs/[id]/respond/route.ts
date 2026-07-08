import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendOrderStatusEmail, sendProofDeclinedNotice } from "@/lib/email";
import { ProductType } from "@/lib/statusSteps";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const { decision, feedback } = await req.json();
  if (!["approved", "changes_requested"].includes(decision)) {
    return NextResponse.json({ error: "Invalid decision" }, { status: 400 });
  }

  // RLS (proofs_customer_respond policy) ensures this only succeeds if the
  // proof belongs to an order owned by the logged-in customer.
  const { data: proof, error: proofError } = await supabase
    .from("proofs")
    .update({ status: decision, feedback: feedback || null, responded_at: new Date().toISOString() })
    .eq("id", params.id)
    .eq("status", "pending")
    .select("*, orders(*), profiles:orders(customer_id)")
    .single();

  if (proofError || !proof) {
    return NextResponse.json({ error: "Couldn't update this proof" }, { status: 400 });
  }

  const order = (proof as any).orders;
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();

  if (decision === "approved") {
    await supabase.from("orders").update({ status: "design_approved" }).eq("id", order.id);

    await sendOrderStatusEmail({
      toEmail: user.email!,
      customerName: profile?.full_name || "there",
      productType: order.product_type as ProductType,
      orderTitle: order.title,
      orderId: order.id,
      newStatus: "design_approved"
    });
  } else {
    await sendProofDeclinedNotice({
      orderTitle: order.title,
      orderId: order.id,
      customerName: profile?.full_name || user.email!,
      feedback: feedback || "(no details given)"
    });
  }

  return NextResponse.json({ ok: true });
}
