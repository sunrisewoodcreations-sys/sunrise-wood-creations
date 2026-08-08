import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendGuestMessageNotice } from "@/lib/email";

// No login required — this is the public guest chat widget. Rate-limiting
// isn't implemented here; if spam becomes an issue later, that's a good
// follow-up (e.g. a simple honeypot field or basic throttling).
export async function POST(req: NextRequest) {
  const { name, email, body } = await req.json();

  if (!name?.trim() || !email?.trim() || !body?.trim()) {
    return NextResponse.json({ error: "Name, email, and a message are all required." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { error } = await admin.from("guest_messages").insert({
    name: name.trim(),
    email: email.trim(),
    body: body.trim()
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  try {
    await sendGuestMessageNotice({
      name: name.trim(),
      email: email.trim(),
      body: body.trim()
    });
  } catch (err) {
    console.error("Guest message notice failed to send:", err);
  }

  return NextResponse.json({ ok: true });
}
