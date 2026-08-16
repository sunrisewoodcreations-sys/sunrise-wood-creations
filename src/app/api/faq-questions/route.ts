import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Public, no-auth submission — anyone can ask a question. This uses
// the admin client specifically so status/is_public/answer can be
// hardcoded here regardless of anything a request tries to set for
// them, rather than trusting the RLS insert policy alone to prevent
// a submitter from marking their own question answered-and-public.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const question = typeof body.question === "string" ? body.question.trim() : "";

  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (!isValidEmail(email)) return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  if (!question) return NextResponse.json({ error: "Question is required" }, { status: 400 });
  if (question.length > 2000) return NextResponse.json({ error: "Question is too long" }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin.from("faq_questions").insert({
    name,
    email,
    question,
    // Hardcoded, never taken from the request body:
    answer: null,
    status: "pending",
    is_public: false
  });

  if (error) return NextResponse.json({ error: "Couldn't submit your question. Please try again." }, { status: 500 });

  return NextResponse.json({ ok: true });
}
