import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendOrderStatusEmail, sendProofDeclinedNotice, sendProofApprovedNotice } from "@/lib/email";
import { ProductType } from "@/lib/statusSteps";

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const supabase = createAdminClient();
  const { decision, feedback } = await req.json();

  if (!["approved", "changes_requested"].includes(decision)) {
    return NextResponse.json({ error: "Invalid decision" }, { status: 400 });
  }

  const { data: proof, error: proofError } = await supabase
    .from("proofs")
    .update({ status: decision, feedback: feedback || null, responded_at: new Date().toISOString() })
    .eq("respond_token", params.token)
    .eq("status", "pending")
    .select("*, orders(*)")
    .single();

  if (proofError || !proof) {
    return NextResponse.json(
      { error: "This link has already been used or is no longer valid." },
      { status: 400 }
    );
  }

  const order = (proof as any).orders;
  const { data: customer } = await supabase.from("profiles").select("*").eq("id", order.customer_id).single();

  if (decision === "approved") {
    await supabase.from("orders").update({ status: "design_approved" }).eq("id", order.id);

    await sendOrderStatusEmail({
      toEmail: customer.email,
      customerName: customer.full_name,
      productType: order.product_type as ProductType,
      orderTitle: order.title,
      orderId: order.id,
      newStatus: "design_approved"
    });

    await sendProofApprovedNotice({
      orderTitle: order.title,
      orderId: order.id,
      customerName: customer.full_name
    });
  } else {
    await sendProofDeclinedNotice({
      orderTitle: order.title,
      orderId: order.id,
      customerName: customer.full_name,
      feedback: feedback || "(no details given)"
    });
  }

  return NextResponse.json({ ok: true });
}
