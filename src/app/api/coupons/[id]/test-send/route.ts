import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendCampaignNow } from "@/lib/campaignSending";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("role, email").eq("id", user?.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  // Defaults to the requesting admin's own account email — never a real
  // customer address — but allows overriding with a different test
  // inbox if the admin wants to check rendering somewhere else.
  const testEmail = body.testEmail || profile.email;
  if (!testEmail) return NextResponse.json({ error: "No test email address available." }, { status: 400 });

  const result = await sendCampaignNow(params.id, { testEmailOverride: testEmail });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true, sentTo: testEmail });
}
