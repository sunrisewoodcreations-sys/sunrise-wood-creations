import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: adminProfile } = await supabase.from("profiles").select("role").eq("id", user?.id).single();

  if (adminProfile?.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { frequency, estimatedTaxSetAsidePercent, recipientEmail } = await req.json();

  const validFrequencies = ["off", "daily", "weekly", "monthly", "quarterly", "yearly"];
  if (!validFrequencies.includes(frequency)) {
    return NextResponse.json({ error: "Invalid frequency" }, { status: 400 });
  }
  if (!recipientEmail?.trim()) {
    return NextResponse.json({ error: "Recipient email is required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("report_settings")
    .update({
      frequency,
      estimated_tax_set_aside_percent: Math.max(0, Math.min(100, Number(estimatedTaxSetAsidePercent) || 0)),
      recipient_email: recipientEmail.trim()
    })
    .eq("id", 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
