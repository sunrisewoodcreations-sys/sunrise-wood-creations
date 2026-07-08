import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendProofReadyEmail } from "@/lib/email";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: adminProfile } = await supabase.from("profiles").select("role").eq("id", user?.id).single();

  if (adminProfile?.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { imageUrl } = await req.json();
  if (!imageUrl?.trim()) {
    return NextResponse.json({ error: "Image URL is required" }, { status: 400 });
  }

  const { data: order } = await supabase
    .from("orders")
    .select("*, profiles:customer_id(email, full_name)")
    .eq("id", params.id)
    .single();

  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const { data: newProof, error: insertError } = await supabase
    .from("proofs")
    .insert({ order_id: order.id, image_url: imageUrl.trim() })
    .select()
    .single();

  if (insertError || !newProof) {
    return NextResponse.json({ error: insertError?.message || "Couldn't create the proof" }, { status: 400 });
  }

  const customer = (order as any).profiles;
  await sendProofReadyEmail({
    toEmail: customer.email,
    customerName: customer.full_name,
    orderTitle: order.title,
    orderId: order.id,
    imageUrl: imageUrl.trim(),
    respondToken: newProof.respond_token
  });

  return NextResponse.json({ ok: true });
}
