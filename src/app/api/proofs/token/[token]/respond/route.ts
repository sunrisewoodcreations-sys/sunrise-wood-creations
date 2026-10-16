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

  // Public, no-login route (the token is the authorization) — there is
  // never a logged-in session here, so sendViaResend's own demo check
  // can never see anything on its own. The order's own is_demo column
  // is the only real signal this route has; fail-safe to "treat as
  // demo" if it's ever missing/not a boolean rather than assume safe.
  const forceDemo = typeof order?.is_demo === "boolean" ? order.is_demo : true;

  if (decision === "approved") {
    await supabase.from("orders").update({ status: "design_approved" }).eq("id", order.id);

    await sendOrderStatusEmail({
      toEmail: customer.email,
      customerName: customer.full_name,
      productType: order.product_type as ProductType,
      orderTitle: order.title,
      orderId: order.id,
      newStatus: "design_approved",
      forceDemo
    });

    await sendProofApprovedNotice({
      orderTitle: order.title,
      orderId: order.id,
      customerName: customer.full_name,
      forceDemo
    });
  } else {
    await sendProofDeclinedNotice({
      orderTitle: order.title,
      orderId: order.id,
      customerName: customer.full_name,
      feedback: feedback || "(no details given)",
      forceDemo
    });
  }

  return NextResponse.json({ ok: true });
}
