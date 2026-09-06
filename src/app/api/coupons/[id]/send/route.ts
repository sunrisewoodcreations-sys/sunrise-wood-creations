import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendCampaignNow, resolveCampaignRecipients } from "@/lib/campaignSending";

async function requireAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user?.id).single();
  return profile?.role === "admin";
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const admin = createAdminClient();
  const { data: campaign } = await admin.from("campaigns").select("*").eq("id", params.id).single();
  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  if (campaign.status !== "draft") {
    return NextResponse.json({ error: "This campaign has already been sent, scheduled, or cancelled." }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const scheduledAt: string | undefined = body.scheduledAt;

  // Never allow sending (or scheduling) an empty campaign — checked
  // against the same real recipient resolution used everywhere else,
  // not a client-supplied count.
  const recipients = await resolveCampaignRecipients(campaign);
  if (recipients.length === 0) {
    return NextResponse.json({ error: "No customers match this campaign's targeting — nothing to send." }, { status: 400 });
  }

  if (scheduledAt) {
    const when = new Date(scheduledAt);
    if (isNaN(when.getTime()) || when.getTime() <= Date.now()) {
      return NextResponse.json({ error: "Choose a scheduled date and time in the future." }, { status: 400 });
    }
    await admin.from("campaigns").update({ status: "scheduled", scheduled_at: when.toISOString() }).eq("id", params.id);
    return NextResponse.json({ scheduled: true, scheduledAt: when.toISOString(), recipientCount: recipients.length });
  }

  const result = await sendCampaignNow(params.id);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result);
}
