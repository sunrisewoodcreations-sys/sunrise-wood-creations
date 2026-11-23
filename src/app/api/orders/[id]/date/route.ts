import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: adminProfile } = await supabase.from("profiles").select("role").eq("id", user?.id).single();

  if (adminProfile?.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { createdAt } = await req.json();
  if (!createdAt || isNaN(Date.parse(createdAt))) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  // A plain date (YYYY-MM-DD) is stored at midday UTC so it stays on the same
  // calendar day in Eastern time (midnight UTC would show as the evening before).
  const stamp = /^\d{4}-\d{2}-\d{2}$/.test(createdAt) ? `${createdAt}T16:00:00.000Z` : new Date(createdAt).toISOString();

  const admin = createAdminClient();
  const { error } = await admin
    .from("orders")
    .update({ created_at: stamp })
    .eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Keep the "Order placed" step in the order history on the same date.
  await admin.from("order_status_history").update({ created_at: stamp }).eq("order_id", params.id).eq("status", "order_placed");

  return NextResponse.json({ ok: true });
}
