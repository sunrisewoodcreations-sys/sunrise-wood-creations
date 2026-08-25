import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendFaqAnswerEmail } from "@/lib/email";

async function requireAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: adminProfile } = await supabase.from("profiles").select("role").eq("id", user?.id).single();
  return adminProfile?.role === "admin";
}

// Lets the admin author an FAQ entry directly — no customer involved
// at all, so it skips the pending state entirely and goes straight to
// answered + public. No email is sent here, since unlike every other
// path in this file, there's no real submitter to notify.
export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const { question, answer } = await req.json();
  if (!question?.trim()) return NextResponse.json({ error: "Question text is required" }, { status: 400 });
  if (!answer?.trim()) return NextResponse.json({ error: "Answer text is required" }, { status: 400 });

  const admin = createAdminClient();
  const { data: inserted, error } = await admin
    .from("faq_questions")
    .insert({
      // name/email are NOT NULL columns shared with the customer-submitted
      // flow — this placeholder makes it obvious in the admin list that
      // this entry didn't come from a real visitor, and it's never shown
      // publicly regardless (name/email are excluded from the public query).
      name: "Added by admin",
      email: "admin@sunrisewoodcreations.com",
      question: question.trim(),
      answer: answer.trim(),
      status: "answered",
      is_public: true,
      answered_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, question: inserted });
}

// Saves an answer and sends the notification email — this is the ONLY
// place in the whole FAQ system that sends an email. Submitting a
// question (the public route) never does; this route only runs when
// an admin explicitly writes and saves an answer, matching the
// requirement precisely.
export async function PATCH(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const { id, answer, isPublic } = await req.json();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  if (!answer?.trim()) return NextResponse.json({ error: "Answer text is required" }, { status: 400 });

  const admin = createAdminClient();

  // status is fetched BEFORE the update specifically to capture whether
  // this question was already answered prior to this save — that's
  // what distinguishes "answering for the first time" (should email)
  // from "editing an already-answered question, or just flipping
  // public/private" (should NOT email again).
  const { data: question } = await admin.from("faq_questions").select("name, email, question, status").eq("id", id).maybeSingle();
  if (!question) return NextResponse.json({ error: "Question not found" }, { status: 404 });

  const isFirstAnswer = question.status !== "answered";

  const { data: updated, error } = await admin
    .from("faq_questions")
    .update({
      answer: answer.trim(),
      is_public: !!isPublic,
      status: "answered",
      answered_at: new Date().toISOString()
    })
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Only sent the very first time this question is answered — editing
  // the answer text later, or just toggling public/private, saves
  // normally but never re-triggers the email.
  if (isFirstAnswer) {
    await sendFaqAnswerEmail({
      name: question.name,
      email: question.email,
      question: question.question,
      answer: answer.trim()
    });
  }

  return NextResponse.json({ ok: true, question: updated, emailSent: isFirstAnswer });
}

export async function DELETE(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin.from("faq_questions").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
