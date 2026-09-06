import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendCampaignNow } from "@/lib/campaignSending";

// NOT currently registered in vercel.json — Vercel's Hobby plan rejects
// any cron schedule more frequent than once daily at deploy time, so a
// */5 * * * * entry here would have blocked the whole deployment. This
// route is left fully functional and ready to be triggered by:
//   (a) an external scheduler (e.g. a free cron service) calling this
//       URL with the correct Authorization: Bearer <CRON_SECRET> header
//       on whatever interval is needed, or
//   (b) re-adding a crons entry for this path in vercel.json if this
//       project is ever upgraded to Vercel Pro (which allows per-minute
//       schedules).
// Until one of those is set up, a "Schedule Send" campaign will sit in
// "scheduled" status and will NOT send itself automatically.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: due } = await admin
    .from("campaigns")
    .select("id")
    .eq("status", "scheduled")
    .lte("scheduled_at", new Date().toISOString());

  const results: any[] = [];
  for (const campaign of due || []) {
    const result = await sendCampaignNow(campaign.id);
    results.push({ campaignId: campaign.id, result });
  }

  return NextResponse.json({ processed: results.length, results });
}
