import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendOrderStatusEmail, sendProofDeclinedNotice, sendProofApprovedNotice } from "@/lib/email";
import { ProductType } from "@/lib/statusSteps";
import { applyDesignDecision } from "@/lib/proofDecisions";

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const supabase = createAdminClient();
  const { decision, feedback, design } = await req.json();
  const designNo: 1 | 2 = design === 2 ? 2 : 1;

  if (!["approved", "changes_requested"].includes(decision)) {
    return NextResponse.json({ error: "Invalid decision" }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("proofs")
    .select("*")
    .eq("respond_token", params.token)
    .eq("status", "pending")
    .maybeSingle();

  const invalid = () => NextResponse.json({ error: "This link has already been used or is no longer valid." }, { status: 400 });
  if (!existing) return invalid();
  if (designNo === 2 && !existing.image_url_2) return invalid();
  if (existing[`design${designNo}_decision`]) return invalid();

  const { patch, final, combinedFeedback } = applyDesignDecision(existing as any, designNo, decision, feedback || "");

  const { data: proof, error: proofError } = await supabase
    .from("proofs")
    .update(patch)
    .eq("id", existing.id)
    .eq("status", "pending")
    .select("*, orders(*)")
    .single();

  if (proofError || !proof) return invalid();

  // Only one design answered so far: nothing to announce yet.
  if (!final) return NextResponse.json({ ok: true, complete: false });

  const order = (proof as any).orders;
  const { data: customer } = await supabase.from("profiles").select("*").eq("id", order.customer_id).single();

  // Public, no-login route (the token is the authorization) — there is
  // never a logged-in session here, so sendViaResend's own demo check
  // can never see anything on its own. The order's own is_demo column
  // is the only real signal this route has; fail-safe to "treat as
  // demo" if it's ever missing/not a boolean rather than assume safe.
  const forceDemo = typeof order?.is_demo === "boolean" ? order.is_demo : true;

  if (final === "approved") {
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
      feedback: combinedFeedback || "(no details given)",
      forceDemo
    });
  }

  return NextResponse.json({ ok: true, complete: true, final });
}
