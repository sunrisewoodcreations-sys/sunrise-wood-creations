import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// A logged-in customer updating their OWN preferences — not admin-gated,
// but scoped strictly to the caller's own id, never anyone else's.
export async function PATCH(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const { notifyOrderUpdates, notifyInvoices, notifyProofs, notifyMessages } = await req.json();

  const { error } = await supabase
    .from("profiles")
    .update({
      notify_order_updates: !!notifyOrderUpdates,
      notify_invoices: !!notifyInvoices,
      notify_proofs: !!notifyProofs,
      notify_messages: !!notifyMessages
    })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
