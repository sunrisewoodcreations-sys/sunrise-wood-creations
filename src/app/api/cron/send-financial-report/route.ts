import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateAndSendFinancialReport, shouldSendToday, Frequency } from "@/lib/financialReport";

// This is called automatically by Vercel Cron once a day (see vercel.json).
// It's protected by CRON_SECRET so nobody else can trigger it by just
// visiting the URL — Vercel automatically sends this header on its own
// scheduled requests.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: settings } = await admin.from("report_settings").select("frequency").eq("id", 1).maybeSingle();

  const frequency = (settings?.frequency || "off") as Frequency;
  const now = new Date();

  if (frequency === "off") {
    return NextResponse.json({ sent: false, reason: "Reports are turned off." });
  }

  if (!shouldSendToday(frequency, now)) {
    return NextResponse.json({ sent: false, reason: "Not the right day for this frequency." });
  }

  try {
    const result = await generateAndSendFinancialReport(frequency, now);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("Financial report generation failed:", err);
    return NextResponse.json({ sent: false, error: err.message }, { status: 500 });
  }
}
