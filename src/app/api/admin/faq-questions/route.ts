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

  const { data: question } = await admin.from("faq_questions").select("name, email, question").eq("id", id).maybeSingle();
  if (!question) return NextResponse.json({ error: "Question not found" }, { status: 404 });

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

  // The email always goes to the person who asked, regardless of
  // public/private — the private/public choice only controls whether
  // it ALSO appears on the website, never whether they get their answer.
  await sendFaqAnswerEmail({
    name: question.name,
    email: question.email,
    question: question.question,
    answer: answer.trim()
  });

  return NextResponse.json({ ok: true, question: updated });
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
