import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const admin = createAdminClient();

  const { data: quote } = await admin.from("quotes").select("id, status, expiration_date").eq("share_token", params.token).maybeSingle();
  if (!quote) return NextResponse.json({ error: "This quote link is invalid." }, { status: 404 });

  if (["accepted", "declined"].includes(quote.status)) {
    return NextResponse.json({ error: `This quote has already been ${quote.status}.` }, { status: 400 });
  }

  const { error } = await admin.from("quotes").update({ status: "declined" }).eq("id", quote.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
