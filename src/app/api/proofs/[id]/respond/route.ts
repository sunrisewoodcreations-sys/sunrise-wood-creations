import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendOrderStatusEmail, sendProofDeclinedNotice, sendProofApprovedNotice } from "@/lib/email";
import { ProductType } from "@/lib/statusSteps";
import { applyDesignDecision } from "@/lib/proofDecisions";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const { decision, feedback, design } = await req.json();
  const designNo: 1 | 2 = design === 2 ? 2 : 1;
  if (!["approved", "changes_requested"].includes(decision)) {
    return NextResponse.json({ error: "Invalid decision" }, { status: 400 });
  }

  // Row-level security limits this to the customer's own proofs.
  const { data: existing } = await supabase.from("proofs").select("*").eq("id", params.id).eq("status", "pending").maybeSingle();
  const bad = () => NextResponse.json({ error: "Couldn't update this proof" }, { status: 400 });
  if (!existing) return bad();
  if (designNo === 2 && !existing.image_url_2) return bad();
  if (existing[`design${designNo}_decision`]) return bad();

  const { patch, final, combinedFeedback } = applyDesignDecision(existing as any, designNo, decision, feedback || "");

  const { data: proof, error: proofError } = await supabase
    .from("proofs")
    .update(patch)
    .eq("id", params.id)
    .eq("status", "pending")
    .select("*, orders(*)")
    .single();

  if (proofError || !proof) return bad();

  if (!final) return NextResponse.json({ ok: true, complete: false });

  const order = (proof as any).orders;
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();

  // This route requires a login, but it's the CUSTOMER's own login, not
  // necessarily the demo admin — so sendViaResend's session-based demo
  // check alone isn't enough to protect a test order here. Use the
  // order's own is_demo column instead; fail-safe to "treat as demo" if
  // it's ever not a plain boolean (should never happen — NOT NULL with
  // a default — but this is the side to err on if it ever did).
  const forceDemo = typeof order?.is_demo === "boolean" ? order.is_demo : true;

  if (final === "approved") {
    await supabase.from("orders").update({ status: "design_approved" }).eq("id", order.id);

    await sendOrderStatusEmail({
      toEmail: user.email!,
      customerName: profile?.full_name || "there",
      productType: order.product_type as ProductType,
      orderTitle: order.title,
      orderId: order.id,
      newStatus: "design_approved",
      forceDemo
    });

    await sendProofApprovedNotice({
      orderTitle: order.title,
      orderId: order.id,
      customerName: profile?.full_name || user.email!,
      forceDemo
    });
  } else {
    await sendProofDeclinedNotice({
      orderTitle: order.title,
      orderId: order.id,
      customerName: profile?.full_name || user.email!,
      feedback: combinedFeedback || "(no details given)",
      forceDemo
    });
  }

  return NextResponse.json({ ok: true, complete: true, final });
}
